// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_BRAIN_TYPES = ["person_clone", "knowledge_base", "philosophy", "practical_guide"];

// ══════════════════════════════════════════════════════════════════════════
//  OPME v2.0 - MODULOS DETERMINÍSTICOS (DUPLICADOS PARA CONSISTÊNCIA EDGE)
// ══════════════════════════════════════════════════════════════════════════

class StyleometryAnalyzer {
  private tokenizeWords(t: string) { return t.toLowerCase().match(/\b\w+\b/g) || []; }
  private tokenizeSentences(t: string) { return t.split(/[.!?]+/).filter(s => s.trim().length > 0); }
  
  analyze(text: string) {
    const words = this.tokenizeWords(text);
    const sentences = this.tokenizeSentences(text);
    if (!words.length) return {};

    const avgWordsPerSentence = words.length / (sentences.length || 1);
    const avgCharsPerWord = words.reduce((a, b) => a + b.length, 0) / words.length;
    const subRate = (text.match(/\b(que|porque|se|quando|embora)\b/gi) || []).length / (sentences.length || 1);
    
    return {
      avgSentenceLength: avgWordsPerSentence.toFixed(1),
      avgWordLength: avgCharsPerWord.toFixed(1),
      subordinationRate: subRate.toFixed(2),
      frequentKeywords: this.getKeywords(words)
    };
  }

  private getKeywords(words: string[]) {
    const stopLines = new Set(['o', 'a', 'de', 'para', 'com', 'em', 'por', 'que', 'e', 'é', 'do', 'da', 'um', 'uma', 'os', 'as', 'ou', 'mas', 'não', 'se']);
    const freq = {};
    words.filter(w => w.length > 3 && !stopLines.has(w)).forEach(w => freq[w] = (freq[w] || 0) + 1);
    return Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  }
}

class EmotionalAnalyzer {
  analyze(text: string) {
    const keys = {
      enthusiasm: /incrível|excelente|ótimo|fantástico|adorei/gi,
      anger: /raiva|absurdo|irritado|detesto|injustiça/gi,
      sage: /análise|fato|evidência|lógica|investigação/gi,
      creator: /inovação|novo|experimento|criação|ideia/gi
    };
    const results = {};
    Object.entries(keys).forEach(([k, reg]) => {
      results[k] = (text.match(reg) || []).length;
    });
    const top = Object.entries(results).sort((a,b) => b[1]-a[1])[0];
    return { dominant: top[0], scores: results };
  }
}

/** Try to extract a JSON object from raw text. */
function extractJSON(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const content = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = content.match(jsonBlockRegex);
  const candidates = match ? [match[1].trim(), content] : [content];
  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(candidate.slice(start, end + 1)); } catch { }
    }
  }
  return null;
}

const SKILLS_INSTRUCTION_TEXT = `Instruções: Avalie habilidades ESPECÍFICAS (ex: "storytelling de dados", "persuasão de vendas") e dê nota 0-10 baseada em evidência.`;

function getPrompts(brainType: string, allText: string, opmeContext: string) {
  let radarField = brainType === "person_clone" ? "personality_traits" : "knowledge_areas";
  
  const systemPrompt = `Você é um Analista de DNA Cognitivo OPME v2.0. Examine o texto e as METRIFICAÇÕES DETERMINÍSTICAS abaixo:
  
${opmeContext}

Retorne APENAS um objeto JSON com:
- "${radarField}": { "traço": nota 0-10 }
- "skills": { "habilidade_especifica": nota 0-10 }
- "skills_evaluation": "justificativa"
- "communication_style": { "formalidade": 0-10, "humor": 0-10, "diretividade": 0-10 }
- "voice_patterns": { "aberturas_tipicas": [], "expressoes_recorrentes": [] }
- "signature_phrases": ["frase 1", "frase 2"]
- "frequent_themes": [{"name": "tema", "count": X}]`;

  const userPrompt = `Baseado nos dados reais: ${allText}`;
  return { systemPrompt, userPrompt, radarField };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const body = await req.json();
    const { brainId, brainType: requestedType } = body;

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: brain } = await supabase.from("brains").select("*").eq("id", brainId).single();
    if (!brain) throw new Error("Brain not found");

    const brainType = requestedType || brain.type || "person_clone";
    const { data: texts } = await supabase.from("brain_texts").select("content").eq("brain_id", brainId);
    if (!texts?.length) throw new Error("Nenhum texto para análise");

    let allText = texts.map(t => t.content).join("\n\n").slice(0, 50000);

    // --- OPME Scan ---
    const stylo = new StyleometryAnalyzer().analyze(allText);
    const emo = new EmotionalAnalyzer().analyze(allText);
    const opmeContext = `[DADOS OPME] Média Sentença: ${stylo.avgSentenceLength}. Arquétipo Emoção: ${emo.dominant}. Vocabulário Chave: ${stylo.frequentKeywords.join(", ")}`;

    const { systemPrompt, userPrompt, radarField } = getPrompts(brainType, allText, opmeContext);

    const models = ["google/gemini-2.0-flash-lite-preview-02-05:free", "meta-llama/llama-3.3-70b-instruct:free"];
    let analysisData = null;

    for (const model of models) {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{role:"system", content: systemPrompt}, {role:"user", content: userPrompt}], temperature: 0.1 })
      });
      if (resp.ok) {
        const d = await resp.json();
        analysisData = extractJSON(d.choices?.[0]?.message?.content);
        if (analysisData) break;
      }
    }

    if (!analysisData) throw new Error("IA falhou na análise");

    // Process and Upsert
    const radarData = analysisData[radarField] || {};
    const skills = analysisData.skills || {};
    const themes = (analysisData.frequent_themes || []).slice(0, 10);

    const upsertData = {
      brain_id: brainId,
      frequent_themes: themes,
      skills,
      skills_evaluation: analysisData.skills_evaluation,
      personality_traits: brainType === "person_clone" ? radarData : null,
      knowledge_areas: brainType !== "person_clone" ? radarData : null,
      communication_style: analysisData.communication_style,
      voice_patterns: analysisData.voice_patterns,
      signature_phrases: (analysisData.signature_phrases || []).slice(0, 10),
      updated_at: new Date().toISOString(),
    };

    await supabase.from("brain_analysis").upsert(upsertData, { onConflict: "brain_id" });

    return new Response(JSON.stringify({ success: true, opme: { stylo, emo } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
