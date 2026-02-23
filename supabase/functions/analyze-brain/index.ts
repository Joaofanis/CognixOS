import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Try to extract a JSON object from a raw text that may contain markdown fences. */
function extractJSON(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
  const candidates = [cleaned, text];
  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // ignore
      }
    }
  }
  return null;
}

// Build prompts based on brain type
function getPrompts(brainType: string, allText: string) {
  let systemPrompt: string;
  let radarField: string;

  switch (brainType) {
    case "knowledge_base":
      radarField = "knowledge_areas";
      systemPrompt = `Você é um analista de conteúdo especialista. Analise os textos fornecidos e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. O JSON deve ter exatamente esta estrutura:
{
  "knowledge_areas": {
    "<área de conhecimento 1>": <número 0-10 representando profundidade>,
    "<área de conhecimento 2>": <número 0-10>,
    ...até 8 áreas
  },
  "frequent_themes": [
    {"name": "<tema>", "count": <número inteiro>}
  ]
}`;
      break;
    case "philosophy":
      radarField = "knowledge_areas";
      systemPrompt = `Você é um analista filosófico especialista. Analise os textos fornecidos e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. O JSON deve ter exatamente esta estrutura:
{
  "knowledge_areas": {
    "<princípio filosófico 1>": <número 0-10 representando relevância>,
    "<princípio filosófico 2>": <número 0-10>,
    ...até 8 princípios
  },
  "frequent_themes": [
    {"name": "<tema>", "count": <número inteiro>}
  ]
}`;
      break;
    case "practical_guide":
      radarField = "knowledge_areas";
      systemPrompt = `Você é um analista de competências práticas especialista. Analise os textos fornecidos e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. O JSON deve ter exatamente esta estrutura:
{
  "knowledge_areas": {
    "<competência prática 1>": <número 0-10 representando domínio>,
    "<competência prática 2>": <número 0-10>,
    ...até 8 competências
  },
  "frequent_themes": [
    {"name": "<tema>", "count": <número inteiro>}
  ]
}`;
      break;
    default: // person_clone
      radarField = "personality_traits";
      systemPrompt = `Você é um analista de personalidade especialista. Analise os textos fornecidos e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. O JSON deve ter exatamente esta estrutura:
{
  "personality_traits": {
    "extroversão": <número 0-10>,
    "criatividade": <número 0-10>,
    "pragmatismo": <número 0-10>,
    "empatia": <número 0-10>,
    "assertividade": <número 0-10>,
    "curiosidade": <número 0-10>,
    "disciplina": <número 0-10>,
    "otimismo": <número 0-10>
  },
  "frequent_themes": [
    {"name": "<tema>", "count": <número inteiro>}
  ]
}`;
      break;
  }

  const userPrompt = `Analise os seguintes textos e retorne o JSON estruturado conforme instrução do sistema:\n\nTextos:\n${allText}`;
  return { systemPrompt, userPrompt, radarField };
}

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

    const { brainId, brainType: requestedType } = await req.json();
    if (!brainId || typeof brainId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid brainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify User JWT
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

    // Verify Ownership and get brain type
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("user_id, type")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (brain.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden: You don't own this brain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brainType = requestedType || brain.type || "person_clone";

    // Get brain texts
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content")
      .eq("brain_id", brainId);

    if (!texts || texts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum texto encontrado para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_CHARS = 30000;
    let allText = texts.map((t) => t.content).join("\n\n");
    if (allText.length > MAX_CHARS) {
      allText = allText.slice(0, MAX_CHARS) + "\n\n[...texto truncado por limite de contexto]";
      console.log(`analyze-brain: truncated text to ${MAX_CHARS} chars`);
    }

    const { systemPrompt, userPrompt, radarField } = getPrompts(brainType, allText);

    const models = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "stepfun/step-3.5-flash:free",
      "google/gemma-3-27b-it:free",
      "mistralai/mistral-7b-instruct:free",
    ];

    let analysisData: Record<string, unknown> | null = null;
    let lastError: { status?: number; text?: string; error?: string } | null = null;

    for (const model of models) {
      try {
        console.log(`analyze-brain: trying model ${model} for type ${brainType}`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 1500,
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const t = await response.text();
          console.error(`Model ${model} failed: ${response.status}`, t);
          lastError = { status: response.status, text: t };
          if (response.status === 401 || response.status === 403) break;
          continue;
        }

        const result = await response.json();
        const rawContent: string = result.choices?.[0]?.message?.content || "";
        console.log(`analyze-brain: raw content from ${model}:`, rawContent.slice(0, 200));

        const parsed = extractJSON(rawContent);
        if (
          parsed &&
          (parsed[radarField] || parsed.personality_traits || parsed.knowledge_areas) &&
          Array.isArray(parsed.frequent_themes)
        ) {
          analysisData = parsed;
          console.log(`analyze-brain: success with model ${model}`);
          break;
        } else {
          console.warn(`Model ${model} returned invalid structure:`, rawContent.slice(0, 300));
          lastError = { error: "Invalid JSON structure from model" };
        }
      } catch (e) {
        console.error(`Fetch error for model ${model}:`, e);
        lastError = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    if (!analysisData) {
      const msg = lastError?.status === 429
        ? "Limite de requisições excedido. Tente novamente em alguns segundos."
        : "Nenhum modelo de IA conseguiu gerar uma análise estruturada. Tente novamente.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract radar data (could be personality_traits or knowledge_areas)
    const radarData = (analysisData[radarField] || analysisData.personality_traits || analysisData.knowledge_areas) as Record<string, number>;
    for (const key of Object.keys(radarData)) {
      radarData[key] = Number(radarData[key]) || 0;
    }

    // Extract themes
    const themes = (analysisData.frequent_themes as Array<{ name: string; count: number }>)
      .map((t) => ({ name: String(t.name), count: Number(t.count) || 1 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Build upsert data - store in appropriate column
    const upsertData: Record<string, unknown> = {
      brain_id: brainId,
      frequent_themes: themes,
      updated_at: new Date().toISOString(),
    };

    if (brainType === "person_clone") {
      upsertData.personality_traits = radarData;
      upsertData.knowledge_areas = null;
    } else {
      upsertData.knowledge_areas = radarData;
      upsertData.personality_traits = null;
    }

    const { error: upsertErr } = await supabase
      .from("brain_analysis")
      .upsert(upsertData, { onConflict: "brain_id" });

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-brain error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
