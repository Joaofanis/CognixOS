// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════════════════
//  OPME v2.0 - FORENSIC & COGNITIVE MODULES
// ══════════════════════════════════════════════════════════════════════════

class StyleometryAnalyzer {
  private tokenizeWords(text: string): string[] { return text.toLowerCase().match(/\b\w+\b/g) || []; }
  private tokenizeSentences(text: string): string[] { return text.split(/[.!?]+/).filter(s => s.trim().length > 0); }
  
  analyze(text: string) {
    const words = this.tokenizeWords(text);
    const sentences = this.tokenizeSentences(text);
    if (!words.length) return { averageSentenceLength: 0, typeTokenRatio: 0, frequentWords: [] };

    const uniqueWords = new Set(words);
    const ttr = uniqueWords.size / words.length;
    const hapax = words.filter(w => words.filter(x => x === w).length === 1).length;
    
    const subRate = (text.match(/\b(que|porque|se|quando|embora|como|pois|portanto)\b/gi) || []).length / (sentences.length || 1);
    
    // Forensic metrics
    const charNGrams = this.getCharNGrams(text, 3);
    
    return {
      averageSentenceLength: words.length / (sentences.length || 1),
      typeTokenRatio: ttr,
      lexicalRichness: (hapax / words.length) * 100,
      subordinationRate: subRate,
      frequentWords: this.getFrequent(words),
      charNGrams,
      intensifiers: ['absolutamente', 'completamente', 'totalmente', 'extremamente', 'muito', 'realmente', 'sinceramente'].filter(w => new RegExp(`\\b${w}\\b`, 'gi').test(text))
    };
  }

  private getCharNGrams(text: string, n: number) {
    const clean = text.toLowerCase().replace(/\s+/g, ' ');
    const grams = {};
    for (let i = 0; i <= clean.length - n; i++) {
        const gram = clean.substring(i, i + n);
        grams[gram] = (grams[gram] || 0) + 1;
    }
    return Object.entries(grams).sort((a,b) => b[1] - a[1]).slice(0, 10).map(e => ({ gram: e[0], count: e[1] }));
  }

  private getFrequent(words: string[]) {
    const stopLines = new Set(['o', 'a', 'de', 'para', 'com', 'em', 'por', 'que', 'e', 'é', 'do', 'da', 'um', 'uma', 'os', 'as', 'ou', 'mas', 'não', 'se', 'mais', 'isso', 'este', 'esta', 'está']);
    const freq = {};
    words.filter(w => w.length > 3 && !stopLines.has(w)).forEach(w => freq[w] = (freq[w] || 0) + 1);
    return Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
  }
}

class EmotionalAnalyzer {
  analyze(text: string) {
    const keys = {
      enthusiasm: /incrível|excelente|bora|vamos|show|perfeito|fantástico/gi,
      anger: /raiva|absurdo|indignado|detesto|injustiça|basta|ridículo/gi,
      fear: /medo|preocupado|receio|talvez|perigo|risco/gi,
      humor: /haha|rsrs|brincadeira|piada|engraçado|sarcasmo|kkk/gi,
      determination: /foco|meta|objetivo|resultado|disciplina|estratégia/gi,
      compassion: /entendo|empatia|ajudar|apoiar|cuidado|solidário/gi
    };
    const results = {};
    Object.entries(keys).forEach(([k, reg]) => {
      results[k] = (text.match(reg) || []).length;
    });
    
    const archetypes = {
      mentor: /ensino|aprenda|guia|orientação|conhecimento|mestre/gi,
      hero: /desafio|superação|vencer|força|garra|vitória/gi,
      sage: /análise|fato|evidência|lógica|razão|ciência/gi,
      sovereign: /ordem|controle|liderança|regra|sistema|poder/gi,
      explorer: /novo|descoberta|viagem|explorar|curiosidade/gi
    };
    const archScores = {};
    Object.entries(archetypes).forEach(([k, reg]) => { archScores[k] = (text.match(reg) || []).length; });

    const totalEmo = Object.values(results).reduce((a,b)=>a+b,0) || 1;
    const topEmotion = Object.entries(results).sort((a,b) => b[1]-a[1])[0];
    const topArch = Object.entries(archScores).sort((a,b) => b[1]-a[1])[0];

    return { 
      dominant: topEmotion[0], 
      archetype: topArch[0],
      scores: results,
      mapping: Object.entries(results).map(([emotion, score]) => ({ emotion, score: score / totalEmo }))
    };
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

function getPrompts(brainType: string, allText: string, opmeContext: string) {
  let radarField = brainType === "person_clone" ? "personality_traits" : "knowledge_areas";
  
  const systemPrompt = `Você é um Analista de DNA Cognitivo Forense OPME v2.0. Examine os dados reais abaixo:
  
${opmeContext}

Sua missão é gerar um perfil de ALTA FIDELIDADE baseado na Hipótese Lexical Fundamental.
Retorne APENAS um objeto JSON com:
- "${radarField}": { "traço": nota 0-10 }
- "hexaco": { 
    "honesty_humility": 0-10, 
    "emotionality": 0-10, 
    "extraversion": 0-10, 
    "agreeableness": 0-10, 
    "conscientiousness": 0-10, 
    "openness": 0-10 
  }
- "forensic_stylometry": {
    "hapax_legomena_ratio": 0-100,
    "syntax_complexity": "baixa|media|alta",
    "signature_patterns": ["n-gram de estilo"],
    "modal_preference": "preferência verbal"
  }
- "identity_chronicle": {
    "nodes": [{"id": "uuid-aqui", "type": "belief|value|heuristic|skill", "label": "Conceito Central"}],
    "edges": [{"source": "id-origem", "target": "id-destino", "label": "Como se conectam"}]
  }
- "fidelity_scores": {
    "adherence": 0-100,
    "consistency": 0-100,
    "naturalness": 0-100
  }
- "disc_profile": { "dominant": "D|I|S|C", "logic": "explicação" }
- "mbti": "Tipo",
- "enneagram": "Tipo",
- "communication_style": { "formalidade": 0-10, "humor": 0-10, "diretividade": 0-10 },
- "voice_patterns": { "aberturas": [], "expressoes": [] },
- "signature_phrases": ["Mapeie AQUI TODAS as expressões, gírias, jargões e bordões recorrentes. NÃO limite a quantidade, mapeie exaustivamente"],
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

    let allText = texts.map(t => t.content).join("\n\n").slice(0, 45000);

    // --- OPME Forensic Scan ---
    const stylo = new StyleometryAnalyzer().analyze(allText);
    const emo = new EmotionalAnalyzer().analyze(allText);
    const opmeContext = `[MÉTRICAS FORENSES DETERMINÍSTICAS] 
Riqueza Lexical (TTR): ${stylo.typeTokenRatio.toFixed(3)}
Hapax Ratio: ${stylo.lexicalRichness.toFixed(2)}%
Comprimento Frase Médio: ${stylo.averageSentenceLength.toFixed(1)}
Arquétipo Persona: ${emo.archetype}
Top Character N-Grams: ${stylo.charNGrams.map(g => g.gram).join(", ")}
Intensificadores: ${stylo.intensifiers.join(", ")}`;

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

    if (!analysisData) throw new Error("IA falhou na análise forense");

    // Process and Upsert
    const radarData = analysisData[radarField] || {};
    const themes = (analysisData.frequent_themes || []).slice(0, 10);

    const upsertData = {
      brain_id: brainId,
      frequent_themes: themes,
      skills: analysisData.skills || {},
      personality_traits: brainType === "person_clone" ? radarData : null,
      knowledge_areas: brainType !== "person_clone" ? radarData : null,
      communication_style: analysisData.communication_style,
      voice_patterns: analysisData.voice_patterns,
      signature_phrases: analysisData.signature_phrases || [],
      disc_profile: analysisData.disc_profile,
      mbti: analysisData.mbti,
      enneagram: analysisData.enneagram,
      cognitive_dna: analysisData.cognitive_dna,
      hexaco: analysisData.hexaco,
      forensic_stylometry: analysisData.forensic_stylometry,
      identity_chronicle: analysisData.identity_chronicle,
      fidelity_scores: analysisData.fidelity_scores,
      updated_at: new Date().toISOString(),
    };

    await supabase.from("brain_analysis").upsert(upsertData, { onConflict: "brain_id" });

    return new Response(JSON.stringify({ success: true, opme: { stylo, emo } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Analysis Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

