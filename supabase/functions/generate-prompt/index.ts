import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Model waterfall — tries in order, skips on rate-limit/error
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "mistralai/mistral-7b-instruct:free",
  "stepfun/step-3.5-flash:free",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safe JSON parsing
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brainId } = body as { brainId: unknown };

    // Validate brainId — must be a UUID
    if (!brainId || typeof brainId !== "string" || !UUID_REGEX.test(brainId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing brainId. Must be a valid UUID." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get brain info and verify ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("name, type, description, user_id")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (brain.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get brain texts for context
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content")
      .eq("brain_id", brainId)
      .order("created_at", { ascending: false })
      .limit(30);

    const MAX_CONTEXT = 20000;
    let context = texts?.map((t) => t.content).join("\n\n---\n\n") || "";
    if (context.length > MAX_CONTEXT) {
      context = context.slice(0, MAX_CONTEXT) + "\n\n[...truncado]";
    }

    if (!context.trim()) {
      return new Response(JSON.stringify({ error: "Esse cérebro não tem textos ainda. Adicione conteúdo na aba Fontes primeiro." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaPrompt = `Você é um especialista em criar System Prompts para clones de IA. Analise os textos abaixo que pertencem ao clone "${brain.name}" (tipo: ${brain.type}) e gere um System Prompt completo e detalhado em português.

O System Prompt gerado deve:
1. Definir a IDENTIDADE CENTRAL do clone — quem ele é, como pensa, como se posiciona
2. Capturar o ESTILO DE COMUNICAÇÃO — vocabulário, gírias, tom, nível de formalidade, expressões recorrentes
3. Identificar TEMAS E ÁREAS DE CONHECIMENTO que o clone domina
4. Definir a POSTURA MENTAL — crenças, princípios, valores que transparecem nos textos
5. Estabelecer REGRAS DE COMPORTAMENTO — como responder, o que evitar, formato preferido
6. Incluir EXEMPLOS de como o clone falaria (few-shot), baseados nos textos reais
7. Ser auto-contido — quem ler o prompt deve entender perfeitamente como a IA deve agir

Formato: Escreva o System Prompt completo, pronto para uso. Use seções com emojis e títulos como no exemplo do usuário. Seja extenso e detalhado.

TEXTOS DO CLONE:
${context}`;

    // Try each model in order — skip on rate limits, break on auth errors
    let generatedPrompt = "";
    let lastError: { status?: number; text?: string } | null = null;

    for (const model of MODELS) {
      try {
        console.log(`generate-prompt: trying model ${model}`);
        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-second-brain.app",
            "X-Title": "AI Second Brain",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "Você gera System Prompts profissionais para clones de IA. Responda APENAS com o System Prompt gerado, sem explicações extras." },
              { role: "user", content: metaPrompt },
            ],
            temperature: 0.7,
            max_tokens: 8000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`generate-prompt: model ${model} failed with ${aiResponse.status}:`, errText);
          lastError = { status: aiResponse.status, text: errText };
          // Fatal errors — don't bother trying other models
          if (aiResponse.status === 401 || aiResponse.status === 403) break;
          continue;
        }

        const result = await aiResponse.json();
        const content = result.choices?.[0]?.message?.content?.trim() || "";
        if (content.length > 20) {
          generatedPrompt = content;
          console.log(`generate-prompt: success with model ${model}`);
          break;
        } else {
          console.warn(`generate-prompt: model ${model} returned empty/short content`);
          lastError = { text: "Empty response from model" };
        }
      } catch (e) {
        console.error(`generate-prompt: fetch error for model ${model}:`, e);
        lastError = { text: e instanceof Error ? e.message : String(e) };
      }
    }

    if (!generatedPrompt) {
      const isRateLimit = lastError?.status === 429;
      const errorMsg = isRateLimit
        ? "Limite de requisições excedido pelos modelos de IA. Aguarde alguns segundos e tente novamente."
        : `Falha em todos os modelos de IA. Último erro: ${lastError?.text || "desconhecido"}`;
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
