// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Auth ───────────────────────────────────────────────────────────────────
async function getUserId(authHeader: string): Promise<string> {
  // @ts-expect-error: Deno is available at runtime in Supabase Edge Functions
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-expect-error: Deno is available at runtime in Supabase Edge Functions
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const c = createClient(url, key, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await c.auth.getUser();
  if (error || !user) throw new Error("Token inválido");
  return user.id;
}

// ── HTML helpers ───────────────────────────────────────────────────────────
function decodeHtml(t: string): string {
  return t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ");
}

function sseEvent(d: Record<string, unknown>): string {
  return `data: ${JSON.stringify(d)}\n\n`;
}

// ── Models with fallback ───────────────────────────────────────────────────
const MODELS = [
  "liquid/lfm-2.5-1.2b-instruct:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "stepfun/step-3.5-flash:free",
  "bytedance/seedance-1-5-pro",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash-lite",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string, maxTokens = 16000): Promise<string> {
  for (const model of MODELS) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://cognixos.app",
          "X-Title": "CognixOS",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      });
      if (!resp.ok) {
        if (resp.status === 401) break;
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content?.trim() || "";
      if (content.length > 30) return content;
    } catch (e) {
      console.error(`callAI ${model}:`, e);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return "";
}

// ══════════════════════════════════════════════════════════════════════════
//  1. OPME v2.0 - MODULOS DETERMINÍSTICOS MATEMÁTICOS (STYLOMETRY & EMOTIONAL)
// ══════════════════════════════════════════════════════════════════════════

export class StyleometryAnalyzer {
  private tokenizeWords(text: string): string[] {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }
  private tokenizeSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }
  calculateAverageWordLength(text: string): number {
    const words = this.tokenizeWords(text);
    if (words.length === 0) return 0;
    const totalChars = words.reduce((sum, word) => sum + word.length, 0);
    return totalChars / words.length;
  }
  calculateAverageSentenceLength(text: string): number {
    const sentences = this.tokenizeSentences(text);
    if (sentences.length === 0) return 0;
    const totalWords = sentences.reduce((sum, sentence) => sum + this.tokenizeWords(sentence).length, 0);
    return totalWords / sentences.length;
  }
  calculateTypeTokenRatio(text: string): number {
    const words = this.tokenizeWords(text);
    const uniqueWords = new Set(words);
    if (words.length === 0) return 0;
    return uniqueWords.size / words.length;
  }
  calculatePunctuationFrequency(text: string): Record<string, number> {
    const punctuation = {
      comma: (text.match(/,/g) || []).length,
      semicolon: (text.match(/;/g) || []).length,
      dash: (text.match(/—|-/g) || []).length,
      exclamation: (text.match(/!/g) || []).length,
      question: (text.match(/\?/g) || []).length,
    };
    const totalChars = text.length || 1;
    return Object.entries(punctuation).reduce((acc, [key, count]) => {
      acc[key] = (count / totalChars) * 1000;
      return acc;
    }, {} as Record<string, number>);
  }
  calculateVerbTensePreference(text: string): Record<string, number> {
    const tenses = {
      present: (text.match(/\b(sou|estou|tenho|faço|vou|digo|penso|falo|quer)\b/gi) || []).length,
      past: (text.match(/\b(era|estava|tinha|fiz|disse|pensei|fui|falou|quis)\b/gi) || []).length,
      future: (text.match(/\b(serei|estarei|terei|farei|direi|pensarei|falarei|quererá)\b/gi) || []).length,
      conditional: (text.match(/\b(seria|estaria|teria|faria|diria|pensaria|falaria|quisera)\b/gi) || []).length,
    };
    const total = Object.values(tenses).reduce((a, b) => a + b, 0);
    if (total === 0) return { present: 0, past: 0, future: 0, conditional: 0 };
    return Object.entries(tenses).reduce((acc, [key, count]) => {
      acc[key] = count / total;
      return acc;
    }, {} as Record<string, number>);
  }
  calculateFrequentWords(text: string, topN = 30): Array<{ word: string; frequency: number }> {
    const words = this.tokenizeWords(text);
    const stopWords = new Set(['o', 'a', 'de', 'para', 'com', 'em', 'por', 'que', 'e', 'é', 'do', 'da', 'um', 'uma', 'os', 'as', 'dos', 'das', 'ou', 'mas', 'não', 'se', 'como', 'mais', 'isso', 'vcs', 'você', 'também', 'pra', 'pela', 'pelo']);
    const filtered = words.filter(word => !stopWords.has(word) && word.length > 2);
    const frequency = new Map<string, number>();
    filtered.forEach(word => frequency.set(word, (frequency.get(word) || 0) + 1));
    return Array.from(frequency.entries()).map(([word, frequency]) => ({ word, frequency })).sort((a, b) => b.frequency - a.frequency).slice(0, topN);
  }
  calculateSubordinationRate(text: string): number {
    const subordinatingConjunctions = /\b(que|porque|se|quando|onde|como|embora|ainda|portanto|pois|contudo|entretanto|assim)\b/gi;
    const matches = text.match(subordinatingConjunctions) || [];
    const sentences = this.tokenizeSentences(text).length;
    return sentences > 0 ? matches.length / sentences : 0;
  }
  private extractUniqueExpressions(text: string): string[] {
    const phrases = text.match(/\b\w+\s+\w+\s+\w+(?:\s+\w+)?\b/g) || [];
    const frequency = new Map<string, number>();
    phrases.forEach(phrase => frequency.set(phrase, (frequency.get(phrase) || 0) + 1));
    return Array.from(frequency.entries()).filter(([, count]) => count >= 2).map(([phrase]) => phrase).slice(0, 15);
  }
  private extractEmotionalIntensifiers(text: string): string[] {
    const intensifiers = ['absolutamente', 'completamente', 'totalmente', 'extremamente', 'muito', 'bastante', 'realmente', 'verdadeiramente', 'sinceramente', 'incrível', 'fantástico', 'excelente', 'perfeito', 'horrível', 'bizarro', 'surreal', 'genial'];
    const found = intensifiers.filter(word => new RegExp(`\\b${word}\\b`, 'gi').test(text));
    return [...new Set(found)];
  }
  private extractSyntaxPatterns(text: string): string[] {
    const patterns = [
      { pattern: /\b\w+\s+\w+\s+\w+\b/g, name: 'SVO Constantes' },
      { pattern: /\b\w+\s+,\s+\w+\s+\w+\b/g, name: 'Subordinadas Clássicas' },
      { pattern: /\b(se|caso)\s+\w+\s+,\s+\w+\b/gi, name: 'Condicionais Diretas' },
    ];
    const found: string[] = [];
    patterns.forEach(({ pattern, name }) => { if (pattern.test(text)) found.push(name); });
    return found;
  }
  async analyzeStyleometry(text: string) {
    return {
      averageWordLength: this.calculateAverageWordLength(text),
      averageSentenceLength: this.calculateAverageSentenceLength(text),
      typeTokenRatio: this.calculateTypeTokenRatio(text),
      punctuationFrequency: this.calculatePunctuationFrequency(text),
      verbTensePreference: this.calculateVerbTensePreference(text),
      frequentWords: this.calculateFrequentWords(text),
      subordinationRate: this.calculateSubordinationRate(text),
      uniqueExpressions: this.extractUniqueExpressions(text),
      emotionalIntensifiers: this.extractEmotionalIntensifiers(text),
      preferredSyntaxPatterns: this.extractSyntaxPatterns(text),
    };
  }
}

export class EmotionalAnalyzer {
  private emotionKeywords = {
    enthusiasm: { keywords: ['incrível', 'fantástico', 'excelente', 'adorei', 'perfeito', 'bora', 'vamos', 'show'], patterns: [/\b(muito|bastante|extremamente)\s+(bom|legal|interessante)/gi] },
    anger: { keywords: ['raiva', 'furioso', 'indignado', 'irritado', 'detesto', 'odeio', 'absurdo', 'basta'], patterns: [/\b(não|nunca|jamais)\s+(aceito|tolero|permito)/gi] },
    fear: { keywords: ['medo', 'assustado', 'preocupado', 'ansioso', 'talvez', 'provavelmente', 'receio'], patterns: [/\b(e\s+se|talvez|possivelmente|pode\s+ser)/gi] },
    humor: { keywords: ['haha', 'rsrs', 'brincadeira', 'piada', 'engraçado', 'sarcasmo', 'kkk', 'top'], patterns: [/\b(tipo|tipo\s+assim|basicamente)\b/gi] },
    compassion: { keywords: ['entendo', 'compreendo', 'empatia', 'ajudar', 'apoiar', 'cuidado', 'pena', 'apoio'], patterns: [/\b(você\s+precisa|vou\s+ajudar|deixa\s+eu)/gi] },
    sadness: { keywords: ['triste', 'infeliz', 'deprimido', 'desapontado', 'frustrado', 'fracasso', 'pena'], patterns: [/\b(não\s+consegui|fracassei|perdi)\b/gi] },
    determination: { keywords: ['foco', 'meta', 'objetivo', 'resultado', 'execução', 'entrega', 'disciplina'], patterns: [/\b(temos\s+que|precisamos\s+de|foco\s+no)/gi] }
  };

  detectEmotion(text: string) {
    const scores: Record<string, number> = {};
    Object.entries(this.emotionKeywords).forEach(([emotion, { keywords, patterns }]) => {
      let score = 0;
      keywords.forEach(keyword => { score += (text.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length * 0.5; });
      patterns.forEach(pattern => { score += (text.match(pattern) || []).length * 0.8; });
      scores[emotion] = score;
    });
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return Object.entries(scores).map(([emotion, score]) => ({ emotion, score: score / total })).sort((a, b) => b.score - a.score);
  }

  identifyEmotionalTriggers(text: string) {
    const triggers: Array<{ trigger: string; emotion: string; intensity: 'low' | 'medium' | 'high' }> = [];
    const triggerPatterns = [
      { pattern: /crítica|feedback negativo|injustiça|estúpido|burro/gi, emotion: 'anger', intensity: 'high' as const },
      { pattern: /fracasso|derrota|perda|acabou/gi, emotion: 'sadness', intensity: 'high' as const },
      { pattern: /sucesso|vitória|conquista|ganhou/gi, emotion: 'enthusiasm', intensity: 'high' as const },
      { pattern: /incerteza|dúvida|talvez|não sei/gi, emotion: 'fear', intensity: 'medium' as const },
    ];
    triggerPatterns.forEach(({ pattern, emotion, intensity }) => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => triggers.push({ trigger: match, emotion, intensity }));
    });
    return triggers;
  }

  identifyArchetype(text: string) {
    const archetypeKeywords = {
      mentor: ['ensino', 'aprenda', 'guia', 'orientação', 'conhecimento', 'aula', 'processo'],
      hero: ['desafio', 'superação', 'conquista', 'vitória', 'força', 'luta', 'garra', 'vencer'],
      sage: ['análise', 'investigação', 'verdade', 'evidência', 'pesquisa', 'fato', 'razão', 'lógica'],
      creator: ['inovação', 'criação', 'original', 'novo', 'experimento', 'ideia', 'arte', 'design'],
      friend: ['empatia', 'conexão', 'amizade', 'apoio', 'comunidade', 'juntos', 'nós', 'pessoal'],
      alchemist: ['transformação', 'resultado', 'prático', 'ação', 'eficiência', 'dinheiro', 'retorno', 'lucro'],
      explorer: ['descoberta', 'curiosidade', 'aventura', 'exploração', 'mundo', 'viagem', 'novo'],
      sovereign: ['ordem', 'controle', 'liderança', 'regra', 'governo', 'direção', 'sistema'],
    };
    const scores: Record<string, number> = {};
    Object.entries(archetypeKeywords).forEach(([archetype, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => score += (text.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length);
      scores[archetype] = score;
    });
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const maxArchetype = entries[0];
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    return { archetype: maxArchetype && maxArchetype[1] > 0 ? maxArchetype[0] : 'sage', score: total > 0 && maxArchetype ? maxArchetype[1] / total : 0 };
  }

  extractCoreValues(text: string) {
    const values = ['liberdade', 'justiça', 'inovação', 'excelência', 'integridade', 'criatividade', 'lealdade', 'verdade', 'riqueza', 'segurança', 'conhecimento', 'poder'];
    const result: Array<{ value: string; frequency: number }> = [];
    values.forEach(value => {
      const matches = text.match(new RegExp(`\\b${value}\\b`, 'gi')) || [];
      if (matches.length > 0) result.push({ value, frequency: matches.length });
    });
    return result;
  }

  async analyzeEmotional(text: string) {
    return {
      dominantEmotions: this.detectEmotion(text),
      primaryArchetype: this.identifyArchetype(text).archetype,
      archetypeScore: this.identifyArchetype(text).score,
      coreValues: this.extractCoreValues(text),
      emotionalTriggers: this.identifyEmotionalTriggers(text),
    };
  }
}
// ══════════════════════════════════════════════════════════════════════════
//  SEARCH FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

async function searchDuckDuckGo(query: string): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const urls: string[] = [];
    const re = /<a class="result__url" href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      try {
        let href = m[1];
        if (href.startsWith("//duckduckgo.com/l/?uddg=")) {
          const ud = new URL("https:" + href);
          const actual = ud.searchParams.get("uddg");
          if (actual) href = decodeURIComponent(actual);
        }
        const u = new URL(href);
        if (["duckduckgo.com", "google.com"].some(d => u.hostname.includes(d))) continue;
        if (["http:", "https:"].includes(u.protocol)) urls.push(href);
      } catch (err) {
        // Ignore invalid URLs
      }
    }
    return [...new Set(urls)].slice(0, 8);
  } catch { return []; }
}

async function searchWikipedia(query: string, lang = "pt"): Promise<string[]> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.query?.search?.length > 0) {
      return [`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.query.search[0].title)}`];
    }
  } catch (err) {
    // Wikipedia API failure
  }
  return [];
}

async function searchYouTube(query: string): Promise<string[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "pt-BR,pt;q=0.9" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const urls: string[] = [];
    const re = /"url":"\/watch\?v=([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (urls.length >= 3) break;
      const v = `https://www.youtube.com/watch?v=${m[1]}`;
      if (!urls.includes(v)) urls.push(v);
    }
    return urls;
  } catch (err) {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTENT EXTRACTION
// ══════════════════════════════════════════════════════════════════════════

async function extractTextFromUrl(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const parsed = new URL(url);
    if (["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(parsed.hostname)) {
      return await extractYouTube(url);
    }
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "application/json", "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    if (!result.data || !result.data.content) return null;
    const text: string = result.data.content.trim();
    if (text.length < 50) return null;
    return { title: result.data.title || parsed.hostname, content: text.slice(0, 60000) };
  } catch (err) {
    return null;
  }
}

async function extractYouTube(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const u = new URL(url);
    const p = u.pathname.split("/");
    let videoId = u.searchParams.get("v");
    if (u.hostname === "youtu.be") videoId = p[1];
    else if (["shorts", "live", "v", "embed"].includes(p[1])) videoId = p[2];
    
    if (!videoId) return null;
    const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageResp.ok) return null;
    const html = await pageResp.text();
    const pm = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!pm) return null;
    const pr = JSON.parse(pm[1]);
    const title = pr?.videoDetails?.title || `YouTube ${videoId}`;
    const desc = pr?.videoDetails?.shortDescription || "";
    const author = pr?.videoDetails?.author || "";
    const kw = pr?.videoDetails?.keywords || [];
    const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (tracks?.length > 0) {
      const track = tracks.find((t: { languageCode: string; baseUrl: string }) => t.languageCode?.startsWith("pt")) ||
        tracks.find((t: { languageCode: string; baseUrl: string }) => t.languageCode?.startsWith("en")) || tracks[0];
      if (track?.baseUrl) {
        try {
          const cr = await fetch(track.baseUrl, { signal: AbortSignal.timeout(8000) });
          if (cr.ok) {
            const xml = await cr.text();
            const segs: string[] = [];
            const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
            let m;
            while ((m = re.exec(xml)) !== null) {
              const d = decodeHtml(m[1].replace(/<[^>]+>/g, "")).trim();
              if (d) segs.push(d);
            }
            if (segs.length > 0) {
              return { title, content: `Título: ${title}\nCanal: ${author}\nTags: ${kw.slice(0, 15).join(", ")}\n\n[Transcrição]:\n${segs.join(" ")}` };
            }
          }
        } catch (err) {
          // Transcript fetch failure
        }
      }
    }
    const parts = [`Título: ${title}`, `Canal: ${author}`];
    if (kw.length > 0) parts.push(`Tags: ${kw.slice(0, 20).join(", ")}`);
    if (desc) parts.push(`\n[Descrição]:\n${desc}`);
    const content = parts.join("\n");
    return content.length > 50 ? { title, content } : null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: PESQUISADOR — Deep exhaustive search
// ══════════════════════════════════════════════════════════════════════════

async function agentPesquisador(
  name: string,
  userUrls: string[],
  send: (d: Record<string, unknown>) => void,
): Promise<{ title: string; content: string }[]> {
  send({ step: "agent_researcher", agent: "Pesquisador", message: `🔍 Iniciando busca exaustiva sobre "${name}"...` });

  let allUrls: string[] = [...userUrls];

  const queries = [
    `"${name}" entrevista OR podcast`,
    `"${name}" filosofia OR visão OR pensamento`,
    `"${name}" frases OR citações OR quotes`,
    `"${name}" opinião OR análise OR artigo`,
    `"${name}" biografia OR história OR trajetória`,
    `"${name}" site:linkedin.com OR site:medium.com`,
  ];

  send({ step: "agent_researcher", agent: "Pesquisador", message: `Executando ${queries.length} buscas especializadas...` });
  const ddgResults = await Promise.all(queries.map(q => searchDuckDuckGo(q)));
  for (const urls of ddgResults) allUrls.push(...urls);

  send({ step: "agent_researcher", agent: "Pesquisador", message: `Buscando Wikipedia PT e EN...` });
  const [wikiPt, wikiEn] = await Promise.all([
    searchWikipedia(name, "pt"),
    searchWikipedia(name, "en"),
  ]);
  allUrls.push(...wikiPt, ...wikiEn);

  send({ step: "agent_researcher", agent: "Pesquisador", message: `Buscando vídeos no YouTube...` });
  const [yt1, yt2] = await Promise.all([
    searchYouTube(`${name} entrevista`),
    searchYouTube(`${name} palestra pensamento`),
  ]);
  allUrls.push(...yt1, ...yt2);

  allUrls = [...new Set(allUrls)].slice(0, 20);
  send({ step: "agent_researcher", agent: "Pesquisador", message: `📋 ${allUrls.length} URLs únicas encontradas`, urls: allUrls });

  if (allUrls.length === 0) {
    send({ step: "agent_researcher", agent: "Pesquisador", message: `⚠️ Nenhuma URL encontrada para "${name}"` });
    return [];
  }

  send({ step: "agent_researcher", agent: "Pesquisador", message: `Extraindo conteúdo de ${allUrls.length} fontes simultaneamente...` });
  const results = await Promise.all(allUrls.map(async (url) => {
    try {
      const r = await extractTextFromUrl(url);
      if (r) {
        send({ step: "agent_researcher_extract", agent: "Pesquisador", message: `✓ ${r.title.substring(0, 50)}`, chars: r.content.length });
      }
      return r;
    } catch { return null; }
  }));

  const extracted = results.filter((r): r is { title: string; content: string } => r !== null);
  send({ step: "agent_researcher_done", agent: "Pesquisador", message: `✅ ${extracted.length} fontes extraídas com sucesso (${extracted.reduce((s, e) => s + e.content.length, 0).toLocaleString()} chars total)` });
  return extracted;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: ANALISTA — Cognitive DNA Report
// ══════════════════════════════════════════════════════════════════════════

async function agentAnalista(
  name: string,
  allContent: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_analyst", agent: "Analista", message: `🧬 Mapeando DNA Cognitivo Base de "${name}"...` });

  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `### AGENT_INSTRUCTIONS
\`\`\`json
{
  "IDENTITY": "Elite Cognitive DNA Analyst",
  "MISSION": "Produce a comprehensive structured report for the individual: ${name}",
  "SECTIONS_REQUIRED": [
    "1. CORE IDENTITY (Mission, area of expertise, differentiator)",
    "2. DISC PROFILE (Grades 1-10 with evidence-based justifications)",
    "3. ENNEAGRAM (Main type + wing with justifications)",
    "4. 10 KEY SOFT SKILLS (Grades 1-10)",
    "5. COGNITIVE TRAITS (Specific thinking patterns)",
    "6. DECISION HEURISTICS (Decision frameworks used)",
    "7. PHILOSOPHY & WORLDVIEW (Core beliefs)",
    "8. SIGNATURE QUOTES (Direct citations from text)",
    "9. ARGUMENTATION PATTERNS",
    "10. DATA GAPS"
  ],
  "OUTPUT_LANGUAGE": "Portuguese (pt-BR)"
}
\`\`\``;

  const report = await callAI(systemPrompt, truncated, apiKey);
  send({ step: "agent_analyst_done", agent: "Analista", message: `✅ Relatório de DNA Cognitivo gerado.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: PSICANALISTA — OPME NEURO-SIMBOLIC (SHADOW DNA + EMOTIONS)
// ══════════════════════════════════════════════════════════════════════════

async function agentPsicanalista(
  name: string,
  allContent: string,
  opmeEmotionContext: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_psycho", agent: "Psicanalista", message: `👁️ Mergulhando nas sombras e gatilhos emocionais OPME v2 de "${name}"...` });

  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `### AGENT_INSTRUCTIONS
\`\`\`json
{
  "IDENTITY": "Jungian Profiler & Shadow Mapper",
  "MISSION": "Analyze text and OPME deterministic metrics to generate a SHADOW REPORT.",
  "DETERMINISTIC_INPUT": "${opmeEmotionContext}",
  "SECTIONS_REQUIRED": [
    "1. HIDDEN MOTIVATIONS & CORE VALUES",
    "2. UNCONSCIOUS BIASES & DOMINANT ARCHETYPE (Validate/Refine GND data)",
    "3. SHADOW DNA (Irrational fears based on detected emotions)",
    "4. DEFENSE MECHANISMS & TRIGGERS",
    "5. REACTION TO CRITICISM"
  ],
  "OUTPUT_LANGUAGE": "Portuguese (pt-BR)"
}
\`\`\``;

  const report = await callAI(systemPrompt, truncated, apiKey);
  send({ step: "agent_psycho_done", agent: "Psicanalista", message: `✅ Relatório Emocional OPME + Shadow DNA concluído.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: LINGUISTA — OPME NEURO-SIMBOLIC (SYNTAX & STYLOMETRY)
// ══════════════════════════════════════════════════════════════════════════

async function agentLinguista(
  name: string,
  allContent: string,
  opmeSyntaxContext: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_linguist", agent: "Linguista", message: `✍️ Decodificando sintaxe usando algoritmos de Stylometry OPME v2...` });

  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `### AGENT_INSTRUCTIONS
\`\`\`json
{
  "IDENTITY": "Linguistic Stylometry Expert",
  "MISSION": "Define how '${name}' communicates by focusing strictly on technical syntax.",
  "INPUT_GND": "${opmeSyntaxContext}",
  "CONSTRAINTS": [
    "Ignore semantic content, focus 100% on structure.",
    "Include reported physical frequencies without questioning.",
    "Mimic chronological/psychological handwriting."
  ],
  "SECTIONS_REQUIRED": [
    "1. RHYTHM & BREATHING (Sentence length based on GND)",
    "2. PUNCTUATION & INTENSIFIERS",
    "3. TRANSITION HABITS (Recurrent connectors)",
    "4. VERBAL TICKS & KEYWORDS",
    "5. CLINICAL IMITATION RULES (5 strict formatting rules)"
  ],
  "OUTPUT_LANGUAGE": "Portuguese (pt-BR)"
}
\`\`\``;

  const report = await callAI(systemPrompt, truncated, apiKey);
  send({ step: "agent_linguist_done", agent: "Linguista", message: `✅ Relatório Sintático Stylometrico validado.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: ESTRATEGISTA — Roleplay Tester (Few-Shot Generation)
// ══════════════════════════════════════════════════════════════════════════

async function agentEstrategista(
  name: string,
  baseDNA: string,
  shadowDNA: string,
  syntaxDNA: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_strategist", agent: "Estrategista", message: `🎭 Simulando cenários de alto estresse e gatilhos...` });

  const prompt = `### AGENT_INSTRUCTIONS
\`\`\`json
{
  "IDENTITY": "Behavioral Strategist (Roleplay Tester)",
  "MISSION": "Generate 3 high-fidelity FEW-SHOT scenarios using extracted DNA.",
  "DETERMINISTIC_GUIDE": { "Style": "${syntaxDNA}", "Shadow": "${shadowDNA}" },
  "SCENARIOS_REQUIRED": [
    "CENÁRIO 1: FRONTAL ATTACK (Immediate reaction to negative feedback)",
    "CENÁRIO 2: ANALYTICAL CHALLENGE (How complex content is transmitted)",
    "CENÁRIO 3: CORE VALUE DILEMMA (Attack on OPME-detected core values)"
  ],
  "OUTPUT_FORMAT": "### Cenário X: [Name]\\n**User:** [Text]\\n**Clone:** [High-fidelity response]",
  "OUTPUT_LANGUAGE": "Portuguese (pt-BR)"
}
\`\`\``;

  const reports = `DNA COGNITIVO:\n${baseDNA}\n\nSHADOW/EMOTION:\n${shadowDNA}\n\nSINTAXE/STYLOMETRY:\n${syntaxDNA}`;
  const report = await callAI(prompt, reports, apiKey, 3000);
  send({ step: "agent_strategist_done", agent: "Estrategista", message: `✅ Roleplays forjados com traços OPME.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: PROMPTER — Ultimate DynamicPromptGenerator (OPME V2.0 Padrão)
// ══════════════════════════════════════════════════════════════════════════

async function agentPrompter(
  name: string,
  reportsComb: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_prompter", agent: "Prompter", message: `⚡ Construindo System Prompt Neuro-Simbólico OPME V2.0 de "${name}"...` });

  const systemPrompt = `### AGENT_INSTRUCTIONS
\`\`\`json
{
  "IDENTITY": "Elite Prompt Engineer & Cognitive Architect",
  "MISSION": "Synthesize MASTER REPORTS into an infallible System Prompt based on the ALAN NICOLAS DNA structure.",
  "TARGET_CLONE": "${name}",
  "SECTIONS_REQUIRED": [
    "1. PSYCHOMETRIC_PROFILE (MBTI, DISC, Enneagram - strictly based on analytical data)",
    "2. DNA_PILLARS (Detailed Lexicon, Cadence, Tone, and Linguistic Rhythm)",
    "3. COGNITIVE_ENGINE (Decision heuristics, world view, and pop culture references used as analogies)",
    "4. EMOTIONAL_MAP (Core values, shadow DNA, and shadow triggers)",
    "5. OPERATIONAL_RULES (RAG integration, roleplay few-shots, and ethical guardrails)"
  ],
  "CONSTRAINTS": "Start with: 'You are now the exact cognitive replication of ${name}.'",
  "OUTPUT_LANGUAGE": "Portuguese (pt-BR)",
  "FINAL_FORMAT": "Extremely detailed System Prompt Text (No generic text, only the prompt body)"
}
\`\`\``;

  const prompt = await callAI(systemPrompt, `MEGA RELATÓRIO OPME:\n\n${reportsComb}`, apiKey);
  
  if (prompt.length > 200) {
    send({ step: "agent_prompter_done", agent: "Prompter", message: `✅ SYSTEM PROMPT ALAN NICOLAS DNA gerado com sucesso.` });
  } else {
    send({ step: "agent_prompter_done", agent: "Prompter", message: `⚠️ Compilação parcial detectada` });
  }
  return prompt;
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTROLLER — Orchestrates the entire line (Neuro-Simbolic Logic)
// ══════════════════════════════════════════════════════════════════════════

async function runSquad(
  name: string,
  userUrls: string[],
  userId: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<void> {
  send({ step: "controller_start", agent: "Controlador", message: `🎯 Iniciando OPME V2 Squad de Elite para Clonagem de "${name}"` });
  
  // @ts-expect-error: Deno check
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Fase 1: Ingestão
  const extractedTexts = await agentPesquisador(name, userUrls, send);
  if (extractedTexts.length === 0) {
    send({ step: "error", message: `Nenhuma fonte encontrada para "${name}".` });
    return;
  }

  const allRawContent = extractedTexts.map(t => `[Titulo: ${t.title}]\n${t.content}`).join("\n\n---\n\n");
  const baseRawText = extractedTexts.map(t => t.content).join("\n\n");

  // Fase OPME Hibrida Módulo Matemático Determinístico
  send({ step: "analyzing_opme", agent: "Motor OPME", message: `⚙️ Analisador Frio detectando padrões determinísticos...` });
  
  const styleAnalyzer = new StyleometryAnalyzer();
  const emotionalAnalyzer = new EmotionalAnalyzer();

  const stylo = await styleAnalyzer.analyzeStyleometry(baseRawText);
  const emo = await emotionalAnalyzer.analyzeEmotional(baseRawText);

  const styloContext = `=== STYLOMETRY GND ===\nMédia Frase: ${stylo.averageSentenceLength.toFixed(1)}\nTTR (Diversidade): ${stylo.typeTokenRatio.toFixed(3)}\nIntensificadores: ${stylo.emotionalIntensifiers.join(", ")}\nPadão de Sintaxe: ${stylo.preferredSyntaxPatterns.join(", ")}\nKeywords: ${stylo.frequentWords.slice(0,15).map(f=>f.word).join(", ")}`;
  
  const emoContext = `=== EMOTIONAL GND ===\nArquétipo: ${emo.primaryArchetype}\nEmoções: ${emo.dominantEmotions.map(e => `${e.emotion}(${e.score.toFixed(2)})`).join(', ')}\nValores: ${emo.coreValues.map(v => v.value).join(", ")}`;

  send({ step: "analyzing_opme_done", agent: "Motor OPME", message: `✅ Scan completo: ${emo.primaryArchetype} detectado.` });

  // Fase 2: Mente Expandida (Paralelismo)
  const [dnaBase, dnaShadow, dnaSyntax] = await Promise.all([
    agentAnalista(name, allRawContent, apiKey, send),
    agentPsicanalista(name, allRawContent, emoContext, apiKey, send),
    agentLinguista(name, allRawContent, styloContext, apiKey, send)
  ]);

  // Fase 3: Simulação de Alta Pressão
  const dnaRoleplay = await agentEstrategista(name, dnaBase, dnaShadow, dnaSyntax, apiKey, send);

  // Fase 4: Engenharia OPME (Prompter Final)
  const comb = `== DNA BASE ==\n${dnaBase}\n\n== SHADOW/EMOTION OPME ==\n${dnaShadow}\n\n== SINTÁTICO OPME ==\n${dnaSyntax}\n\n== FEW-SHOTS ==\n${dnaRoleplay}`;
  const systemPrompt = await agentPrompter(name, comb, apiKey, send);

  // Fase 5: Persistência OPME V2.0
  send({ step: "saving", agent: "Controlador", message: `💾 Forjando os elos neurais V2 no Supabase...` });

  const { data: brain, error: brainErr } = await supabase
    .from("brains")
    .insert({
      name,
      type: "person_clone",
      user_id: userId,
      description: `Clone OPME V2 (Alan Nicolas DNA) de ${name} — Arquétipo: ${emo.primaryArchetype}`,
      tags: [name.toLowerCase(), "opme-v2", "alan-nicolas-dna"],
      system_prompt: systemPrompt
    }).select("id").single();

  if (brainErr || !brain) {
    send({ step: "error", message: `Erro ao criar cérebro: ${brainErr?.message || "desconhecido"}` });
    return;
  }

  // Save texts and analysis
  await Promise.all(extractedTexts.map(t =>
    supabase.from("brain_texts").insert({
      brain_id: brain.id, content: t.content, source_type: "auto_clone", file_name: t.title,
    })
  ));

  // Upsert into brain_analysis with new profile data
  const { error: analysisErr } = await supabase.from("brain_analysis").insert({
    brain_id: brain.id,
    personality_traits: emo.dominantEmotions.reduce((acc, e) => ({ ...acc, [e.emotion]: Math.round(e.score * 100) }), {}),
    disc_profile: { dominant: emo.primaryArchetype.toUpperCase(), mapping: emo.dominantEmotions },
    cognitive_dna: {
      pillars: { lexicon: stylo.frequentWords, cadence: stylo.averageSentenceLength, style: stylo.preferredSyntaxPatterns },
      heuristics: dnaBase,
      shadow: dnaShadow
    },
    communication_style: { tempo: stylo.averageSentenceLength, complexity: stylo.subordinationRate, rhythm: stylo.typeTokenRatio },
    voice_patterns: { patterns: stylo.preferredSyntaxPatterns, intensifiers: stylo.emotionalIntensifiers },
    signature_phrases: stylo.uniqueExpressions
  });

  if (analysisErr) console.error("Error saving brain_analysis:", analysisErr);

  send({ step: "done", brainId: brain.id, message: `🧠 OPME V2 Clone de "${name}" criado com SUCESSO! DNA persistido.` });
}

// ══════════════════════════════════════════════════════════════════════════
//  HTTP Handler
// ══════════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await getUserId(authHeader);
    const { name, urls, brainName, messages } = await req.json();

    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedMessages = (messages as { role: string; content: string }[]).map(
      (msg) => ({
        role: msg.role,
        content: msg.content.trim(),
      }),
    );

    // @ts-expect-error: check
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY)
      throw new Error("OPENROUTER_API_KEY not configured");

    // @ts-expect-error: check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-expect-error: check
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // @ts-expect-error: check
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // @ts-expect-error: check
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

    const userUrls = Array.isArray(urls) ? urls.filter((u: unknown) => typeof u === "string") : [];
    const cloneName = brainName || name;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (d: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(sseEvent(d)));
        };
        try {
          await runSquad(cloneName, userUrls, userId, apiKey, send);
        } catch (e) {
          console.error("auto-clone squad error:", e);
          send({ step: "error", message: e instanceof Error ? e.message : "Erro desconhecido" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("auto-clone error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
