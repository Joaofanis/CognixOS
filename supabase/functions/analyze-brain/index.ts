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
  // Remove markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
  // Try full string first
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

    const { brainId } = await req.json();
    if (!brainId || typeof brainId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid brainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify User JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("user_id")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (brain.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden: You don't own this brain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Truncate text to ~30k characters (~8k tokens) to fit model context limits
    const MAX_CHARS = 30000;
    let allText = texts.map((t) => t.content).join("\n\n");
    if (allText.length > MAX_CHARS) {
      allText = allText.slice(0, MAX_CHARS) + "\n\n[...texto truncado por limite de contexto]";
      console.log(`analyze-brain: truncated text from ${texts.map(t=>t.content).join("").length} to ${MAX_CHARS} chars`);
    }

    const SYSTEM_PROMPT = `Você é um analista de personalidade especialista. Analise os textos fornecidos e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. O JSON deve ter exatamente esta estrutura:
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

    const USER_PROMPT = `Analise os seguintes textos de uma pessoa e retorne o JSON estruturado conforme instrução do sistema:\n\nTextos:\n${allText}`;

    const models = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "stepfun/step-3.5-flash:free",
      "google/gemma-3-27b-it:free",
      "mistralai/mistral-7b-instruct:free",
    ];

    let analysisData: { personality_traits: Record<string, number>; frequent_themes: Array<{ name: string; count: number }> } | null = null;
    let lastError: { status?: number; text?: string; error?: string } | null = null;

    for (const model of models) {
      try {
        console.log(`analyze-brain: trying model ${model}`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: USER_PROMPT },
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
          parsed.personality_traits &&
          typeof parsed.personality_traits === "object" &&
          Array.isArray(parsed.frequent_themes)
        ) {
          analysisData = parsed as typeof analysisData;
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

    // Ensure numeric values in personality_traits
    const traits = analysisData.personality_traits;
    for (const key of Object.keys(traits)) {
      traits[key] = Number(traits[key]) || 0;
    }

    // Ensure numeric counts in themes and sort descending
    const themes = analysisData.frequent_themes
      .map((t: { name: string; count: number }) => ({ name: String(t.name), count: Number(t.count) || 1 }))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 15);

    // Upsert analysis
    const { error: upsertErr } = await supabase
      .from("brain_analysis")
      .upsert(
        {
          brain_id: brainId,
          personality_traits: traits,
          frequent_themes: themes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "brain_id" }
      );

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
