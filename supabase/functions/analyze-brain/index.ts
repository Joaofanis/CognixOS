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

  const skillsInstruction = `  "skills": {
    "<nome da habilidade escolhida pela IA 1>": <número 0-10 representando nível de domínio>,
    "<nome da habilidade escolhida pela IA 2>": <número 0-10>,
    ...até 8 habilidades específicas identificadas nos textos, nomeadas livremente pela IA com base no conteúdo real
  }`;

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
${skillsInstruction},
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
${skillsInstruction},
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
${skillsInstruction},
  "frequent_themes": [
    {"name": "<tema>", "count": <número inteiro>}
  ]
}`;
      break;
    default: // person_clone — análise AVANÇADA de personalidade
      radarField = "personality_traits";
      systemPrompt = `Você é um psicólogo comportamental e linguista especialista em perfis humanos. Sua missão é analisar profundamente os textos fornecidos para criar um perfil completo e detalhado desta pessoa, capturando sua essência para cloná-la com perfeição máxima.

Analise os textos e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. O JSON deve ter exatamente esta estrutura:
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
${skillsInstruction},
  "communication_style": {
    "formalidade": <0=super informal, 10=extremamente formal>,
    "humor": <0=sério, 10=muito bem-humorado>,
    "riqueza_vocabular": <0=simples, 10=vocabulário complexo/técnico>,
    "diretividade": <0=muito indireto/diplomático, 10=muito direto/objetivo>,
    "expressividade_emocional": <0=reservado, 10=muito expressivo>,
    "linguagem_tecnica": <0=cotidiana, 10=muito técnica/especializada>
  },
  "voice_patterns": {
    "aberturas_tipicas": ["<como costuma começar textos/argumentos — 3 exemplos reais ou padrões>"],
    "palavras_de_transicao": ["<conectivos e marcadores discursivos que usa frequentemente>"],
    "expressoes_recorrentes": ["<expressões, jargões ou frases feitas que repete — baseadas nos textos>"],
    "estrutura_preferida": "<descreva o padrão: ex 'começa com pergunta retórica, desenvolve com exemplos, conclui com insight'>",
    "tom_predominante": "<ex: reflexivo e analítico, entusiasmado e inspiracional, cético e questionador>"
  },
  "signature_phrases": [
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 1>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 2>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 3>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 4>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 5>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 6>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 7>",
    "<frase ou expressão marcante RETIRADA DIRETAMENTE dos textos 8>"
  ],
  "frequent_themes": [
    {"name": "<tema>", "count": <número inteiro>}
  ]
}`;
      break;
  }

  const userPrompt = `Analise os seguintes textos e retorne o JSON estruturado conforme instrução do sistema:\n\nTextos:\n${allText}`;
  return { systemPrompt, userPrompt, radarField };
}

// Validation constants
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_BRAIN_TYPES = ["person_clone", "knowledge_base", "philosophy", "practical_guide"];
const MAX_BODY_SIZE = 1024 * 1024;

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

    const contentLength = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request body too large. Maximum size is 1MB." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brainId, brainType: requestedType } = body as { brainId: unknown; brainType: unknown };

    if (!brainId || typeof brainId !== "string" || !UUID_REGEX.test(brainId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing brainId. Must be a valid UUID." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestedType !== undefined && requestedType !== null) {
      if (typeof requestedType !== "string" || !VALID_BRAIN_TYPES.includes(requestedType)) {
        return new Response(JSON.stringify({ error: `Invalid brainType "${requestedType}". Must be one of: ${VALID_BRAIN_TYPES.join(", ")}.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("user_id, type, name")
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

    // Larger context for person_clone to capture personality better
    const MAX_CHARS = brainType === "person_clone" ? 60000 : 30000;
    let allText = texts.map((t) => t.content).join("\n\n---\n\n");
    if (allText.length > MAX_CHARS) {
      allText = allText.slice(0, MAX_CHARS) + "\n\n[...texto truncado por limite de contexto]";
      console.log(`analyze-brain: truncated text to ${MAX_CHARS} chars`);
    }

    const { systemPrompt, userPrompt, radarField } = getPrompts(brainType, allText);

    // For person_clone use more capable models first
    const models = [
      "google/gemini-2.5-flash-preview-09-2025",
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
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
            "HTTP-Referer": "https://ai-second-brain.app",
            "X-Title": "AI Second Brain - Brain Analyzer",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 4000,
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
        console.log(`analyze-brain: raw content from ${model}:`, rawContent.slice(0, 300));

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

    // Extract radar data
    const radarData = (analysisData[radarField] || analysisData.personality_traits || analysisData.knowledge_areas) as Record<string, number>;
    for (const key of Object.keys(radarData)) {
      radarData[key] = Math.min(10, Math.max(0, Number(radarData[key]) || 0));
    }

    // Extract AI-chosen skills (normalize to numbers, cap at 8)
    const rawSkills = (analysisData.skills || {}) as Record<string, unknown>;
    const skills: Record<string, number> = {};
    for (const [key, val] of Object.entries(rawSkills).slice(0, 8)) {
      skills[key] = Math.min(10, Math.max(0, Number(val) || 0));
    }

    // Extract themes
    const themes = (analysisData.frequent_themes as Array<{ name: string; count: number }>)
      .map((t) => ({ name: String(t.name), count: Number(t.count) || 1 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Build upsert data
    const upsertData: Record<string, unknown> = {
      brain_id: brainId,
      frequent_themes: themes,
      skills,
      updated_at: new Date().toISOString(),
    };

    if (brainType === "person_clone") {
      upsertData.personality_traits = radarData;
      upsertData.knowledge_areas = null;

      // Save enhanced person_clone analysis fields
      if (analysisData.communication_style && typeof analysisData.communication_style === "object") {
        const cs = analysisData.communication_style as Record<string, unknown>;
        const normalizedCS: Record<string, number> = {};
        for (const [k, v] of Object.entries(cs)) {
          normalizedCS[k] = Math.min(10, Math.max(0, Number(v) || 0));
        }
        upsertData.communication_style = normalizedCS;
      }

      if (analysisData.voice_patterns && typeof analysisData.voice_patterns === "object") {
        upsertData.voice_patterns = analysisData.voice_patterns;
      }

      if (Array.isArray(analysisData.signature_phrases)) {
        const sp = (analysisData.signature_phrases as unknown[])
          .filter((p) => typeof p === "string" && (p as string).length > 5)
          .slice(0, 12);
        upsertData.signature_phrases = sp;

        // Upsert signature phrases into brain_quotes table
        if (sp.length > 0) {
          const quotesToInsert = sp.map((q) => ({
            brain_id: brainId,
            quote: q as string,
            context: "Análise automática de perfil",
          }));
          // Delete old auto-generated quotes (those without source_text_id) and re-insert
          await supabase
            .from("brain_quotes")
            .delete()
            .eq("brain_id", brainId)
            .is("source_text_id", null);
          await supabase.from("brain_quotes").insert(quotesToInsert);
        }
      }
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
