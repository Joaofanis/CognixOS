// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Auth ───────────────────────────────────────────────────────────────────
async function getUserId(authHeader: string): Promise<string> {
  const url = Deno.env.get("SUPABASE_URL")!;
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
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash-001",
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
          "HTTP-Referer": "https://ai-second-brain.app",
          "X-Title": "AI Second Brain",
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
      } catch {}
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
  } catch {}
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
  } catch { return []; }
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
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SegundoCerebro/1.0)", Accept: "text/html,text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/\s{3,}/g, "\n\n").trim();
    if (text.length < 100) return null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return { title: titleMatch?.[1]?.trim() || parsed.hostname, content: text.slice(0, 50000) };
  } catch { return null; }
}

async function extractYouTube(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (u.hostname === "youtu.be") videoId = u.pathname.slice(1).split("/")[0];
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
      const track = tracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
        tracks.find((t: any) => t.languageCode?.startsWith("en")) || tracks[0];
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
        } catch {}
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

  // 8 specialized search queries
  const queries = [
    `"${name}" entrevista OR podcast`,
    `"${name}" filosofia OR visão OR pensamento`,
    `"${name}" frases OR citações OR quotes`,
    `"${name}" opinião OR análise OR artigo`,
    `"${name}" biografia OR história OR trajetória`,
    `"${name}" site:linkedin.com OR site:medium.com`,
  ];

  // Execute all DDG queries in parallel
  send({ step: "agent_researcher", agent: "Pesquisador", message: `Executando ${queries.length} buscas especializadas...` });
  const ddgResults = await Promise.all(queries.map(q => searchDuckDuckGo(q)));
  for (const urls of ddgResults) allUrls.push(...urls);

  // Wikipedia PT + EN in parallel
  send({ step: "agent_researcher", agent: "Pesquisador", message: `Buscando Wikipedia PT e EN...` });
  const [wikiPt, wikiEn] = await Promise.all([
    searchWikipedia(name, "pt"),
    searchWikipedia(name, "en"),
  ]);
  allUrls.push(...wikiPt, ...wikiEn);

  // YouTube with multiple queries
  send({ step: "agent_researcher", agent: "Pesquisador", message: `Buscando vídeos no YouTube...` });
  const [yt1, yt2] = await Promise.all([
    searchYouTube(`${name} entrevista`),
    searchYouTube(`${name} palestra pensamento`),
  ]);
  allUrls.push(...yt1, ...yt2);

  // Deduplicate
  allUrls = [...new Set(allUrls)].slice(0, 20);
  send({ step: "agent_researcher", agent: "Pesquisador", message: `📋 ${allUrls.length} URLs únicas encontradas`, urls: allUrls });

  if (allUrls.length === 0) {
    send({ step: "agent_researcher", agent: "Pesquisador", message: `⚠️ Nenhuma URL encontrada para "${name}"` });
    return [];
  }

  // Extract content from all URLs in parallel
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
  extractedTexts: { title: string; content: string }[],
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_analyst", agent: "Analista", message: `🧬 Mapeando DNA Cognitivo de "${name}"...` });

  const allContent = extractedTexts.map(t => `[Fonte: ${t.title}]\n${t.content}`).join("\n\n---\n\n");
  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `Você é um ANALISTA DE DNA COGNITIVO de elite. Sua missão é analisar profundamente os textos de/sobre "${name}" e produzir um RELATÓRIO ESTRUTURADO completo.

Você deve extrair o DNA Cognitivo seguindo o paradigma de Clonagem Digital avançada.

PRODUZA UM RELATÓRIO com TODAS estas seções (em formato estruturado):

## 1. IDENTIDADE CENTRAL
Quem é a pessoa, missão, diferencial, área de atuação.

## 2. PERFIL DISC
Avalie de 1-10 cada dimensão: D (Dominância), I (Influência), S (Estabilidade), C (Conformidade/Cautela).
Justifique cada nota com exemplos dos textos.

## 3. ENEAGRAMA
Identifique o tipo principal + asa (ex: 7w8, 3w4, 8w7). Justifique.

## 4. 10 SOFT SKILLS (Protocolo de Avaliação)
Avalie de 1-10 cada: Criatividade/Inovação, Comunicação Clara, Didática/Empatia, Flexibilidade, Foco em Resultados, Persistência, Proatividade, Gestão de Projetos, Pensamento Analítico/Estratégico, Atenção aos Detalhes.

## 5. TRAÇOS COGNITIVOS
Mínimo 8 traços observáveis (ex: "simplifica complexidade", "desafia premissas", "pensa em sistemas").

## 6. HEURÍSTICAS DE DECISÃO
Como a pessoa toma decisões? Quais frameworks mentais usa? Mínimo 5 heurísticas.

## 7. FILOSOFIA E VISÃO DE MUNDO
Crenças centrais, princípios, posicionamentos. O que defende? O que combate?

## 8. ESTILO DE COMUNICAÇÃO
Tom, formalidade (1-10), uso de humor (1-10), ritmo, comprimento das frases, uso de metáforas.

## 9. VOCABULÁRIO ASSINATURA
Mínimo 20 termos/expressões que a pessoa usa frequentemente.

## 10. FRASES REAIS MARCANTES
Mínimo 10 frases reais extraídas dos textos (citações diretas).

## 11. PADRÕES DE ARGUMENTAÇÃO
Como a pessoa constrói argumentos? Usa dados? Histórias? Provocações? Analogias?

## 12. METÁFORAS E ANALOGIAS PREFERIDAS
Mínimo 5 metáforas/analogias que a pessoa usa recorrentemente.

## 13. GATILHOS ANTI-HYPE
O que a pessoa questiona? Que buzzwords ela combate? Como reage a ideias vagas?

## 14. LACUNAS IDENTIFICADAS
O que NÃO foi possível mapear com os dados disponíveis?

IMPORTANTE: Baseie-se EXCLUSIVAMENTE nos textos fornecidos. Se não houver evidência suficiente para uma seção, diga explicitamente "Dados insuficientes para esta análise" e liste o que precisaria ser buscado.`;

  const report = await callAI(systemPrompt, truncated, apiKey);
  
  if (report.length > 100) {
    send({ step: "agent_analyst_done", agent: "Analista", message: `✅ Relatório de DNA Cognitivo gerado (${report.length.toLocaleString()} chars)` });
  } else {
    send({ step: "agent_analyst_done", agent: "Analista", message: `⚠️ Relatório parcial gerado — dados podem ser limitados` });
  }
  
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: VERIFICADOR — Quality & completeness check
// ══════════════════════════════════════════════════════════════════════════

interface VerificationResult {
  approved: boolean;
  score: number;
  missingAreas: string[];
  suggestions: string[];
}

async function agentVerificador(
  name: string,
  report: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<VerificationResult> {
  send({ step: "agent_verifier", agent: "Verificador", message: `🔎 Avaliando completude e qualidade do relatório...` });

  const systemPrompt = `Você é um VERIFICADOR DE QUALIDADE especializado em Clonagem Digital. Sua função é avaliar se um Relatório de DNA Cognitivo está completo e preciso o suficiente para gerar um clone digital de alta qualidade.

Avalie o relatório e responda EXCLUSIVAMENTE neste formato JSON (sem markdown, sem texto extra):
{
  "approved": true/false,
  "score": 0-100,
  "missing_areas": ["lista de seções fracas ou ausentes"],
  "suggestions": ["sugestões específicas para melhorar"],
  "search_queries": ["queries de busca para preencher lacunas, se necessário"]
}

Critérios de aprovação (score >= 70):
- Identidade clara e diferenciada
- Perfil DISC com justificativas
- Pelo menos 5 traços cognitivos concretos
- Pelo menos 8 frases reais
- Vocabulário assinatura com 15+ termos
- Estilo de comunicação definido
- Padrões de argumentação identificados`;

  const result = await callAI(systemPrompt, `RELATÓRIO DE DNA COGNITIVO DE "${name}":\n\n${report}`, apiKey, 2000);
  
  try {
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const verification: VerificationResult = {
        approved: parsed.approved ?? false,
        score: parsed.score ?? 0,
        missingAreas: parsed.missing_areas ?? [],
        suggestions: parsed.suggestions ?? [],
      };
      
      send({
        step: "agent_verifier_done",
        agent: "Verificador",
        message: verification.approved
          ? `✅ Relatório APROVADO — Score: ${verification.score}/100`
          : `⚠️ Score: ${verification.score}/100 — ${verification.missingAreas.length} áreas a melhorar`,
        score: verification.score,
        approved: verification.approved,
      });
      
      return verification;
    }
  } catch (e) {
    console.error("Verifier parse error:", e);
  }
  
  // Fallback: approve if report is long enough
  const fallbackApproved = report.length > 2000;
  send({
    step: "agent_verifier_done",
    agent: "Verificador",
    message: fallbackApproved ? `✅ Relatório aprovado (avaliação simplificada)` : `⚠️ Relatório curto — tentando melhorar`,
    score: fallbackApproved ? 75 : 40,
    approved: fallbackApproved,
  });
  
  return { approved: fallbackApproved, score: fallbackApproved ? 75 : 40, missingAreas: [], suggestions: [] };
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: PROMPTER — Generate final 12-layer System Prompt
// ══════════════════════════════════════════════════════════════════════════

async function agentPrompter(
  name: string,
  report: string,
  rawContent: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_prompter", agent: "Prompter", message: `⚡ Gerando Sistema Operacional Cognitivo com 12 camadas...` });

  const rawTruncated = rawContent.length > 30000 ? rawContent.slice(0, 30000) : rawContent;

  const systemPrompt = `Você é um ENGENHEIRO DE PROMPTS DE ELITE especializado em CLONAGEM COGNITIVA. Use o Relatório de DNA Cognitivo + conteúdo bruto para gerar o System Prompt DEFINITIVO que replica como "${name}" PENSA, DECIDE e SE EXPRESSA.

REGRAS DE ENGENHARIA:
- Use tags XML (<escrita>, <estilo>, <contexto>) para blindar instruções
- Prioridade: padrões de pensamento > exemplos few-shot > reações > estilo > vocabulário
- O prompt deve ser um SISTEMA OPERACIONAL COGNITIVO, não uma descrição passiva
- Inclua árvores de decisão e heurísticas operacionais

O System Prompt DEVE conter TODAS estas 12 seções:

1. 🧠 IDENTIDADE CENTRAL — quem é, missão, diferencial, por que existe
2. 🧬 TRAÇOS COGNITIVOS — mínimo 8 traços com exemplos comportamentais
3. ⚙️ PADRÕES DE PENSAMENTO E HEURÍSTICAS — frameworks mentais, árvore de decisão IF/THEN
4. 💡 POSTURA MENTAL — crenças como regras operacionais concretas
5. 🛑 MÓDULO ANTI-HYPE — como questionar buzzwords, reagir a ideias vagas, exigir especificidade
6. 🗣️ ESTILO DE COMUNICAÇÃO — tom, formalidade, ritmo, comprimento, pausas dramáticas
7. ✨ VOCABULÁRIO ASSINATURA — mínimo 20 termos com contexto de uso
8. 💬 FRASES REAIS — mínimo 10 frases extraídas com contexto de quando usar
9. 🔄 REAÇÕES PADRÃO — tabela de "SE input=X ENTÃO reaja com Y"
10. 📋 FORMATO DE RESPOSTA — 5 passos: Diagnóstico → Insight Central → Explicação Simples → Aplicação Prática → Pergunta Provocativa
11. 🎯 EXEMPLOS FEW-SHOT — mínimo 3 pares pergunta/resposta completos no estilo da pessoa
12. 🚫 REGRAS DE PERSONAGEM — nunca quebrar persona, anti-alucinação de estilo, o que NUNCA fazer

GERE APENAS O SYSTEM PROMPT FINAL. Sem explicações, sem introdução. Apenas o prompt operacional completo.`;

  const userPrompt = `RELATÓRIO DE DNA COGNITIVO:\n${report}\n\n---\n\nCONTEÚDO BRUTO DE REFERÊNCIA:\n${rawTruncated}`;

  const prompt = await callAI(systemPrompt, userPrompt, apiKey);
  
  if (prompt.length > 200) {
    send({ step: "agent_prompter_done", agent: "Prompter", message: `✅ System Prompt gerado com ${prompt.length.toLocaleString()} chars` });
  } else {
    send({ step: "agent_prompter_done", agent: "Prompter", message: `⚠️ Prompt gerado parcialmente` });
  }
  
  return prompt;
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTROLLER — Orchestrates all agents with iteration loop
// ══════════════════════════════════════════════════════════════════════════

async function runSquad(
  name: string,
  userUrls: string[],
  userId: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<void> {
  send({ step: "controller_start", agent: "Controlador", message: `🎯 Iniciando Squad de Clonagem Digital para "${name}"` });
  send({ step: "controller_start", agent: "Controlador", message: `4 agentes especializados serão ativados: Pesquisador → Analista → Verificador → Prompter` });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── PHASE 1: Research ──
  let extractedTexts = await agentPesquisador(name, userUrls, send);

  if (extractedTexts.length === 0) {
    send({ step: "error", message: `Nenhuma fonte encontrada para "${name}". Tente adicionar URLs manualmente.` });
    return;
  }

  // ── PHASE 2-3: Analysis + Verification Loop (max 2 iterations) ──
  let report = "";
  let iteration = 0;
  const MAX_ITERATIONS = 2;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    send({ step: "controller_iteration", agent: "Controlador", message: `📊 Iteração ${iteration}/${MAX_ITERATIONS} do ciclo de análise` });

    // Agent: Analista
    report = await agentAnalista(name, extractedTexts, apiKey, send);

    if (!report || report.length < 200) {
      send({ step: "agent_analyst", agent: "Analista", message: `⚠️ Relatório muito curto, continuando com dados disponíveis...` });
      break;
    }

    // Agent: Verificador
    const verification = await agentVerificador(name, report, apiKey, send);

    if (verification.approved || iteration >= MAX_ITERATIONS) {
      if (verification.approved) {
        send({ step: "controller_iteration", agent: "Controlador", message: `✅ Relatório aprovado pelo Verificador na iteração ${iteration}` });
      } else {
        send({ step: "controller_iteration", agent: "Controlador", message: `⏩ Iterações esgotadas — prosseguindo com melhor relatório disponível (Score: ${verification.score}/100)` });
      }
      break;
    }

    // Need improvement — do additional search if missing areas specified
    send({ step: "controller_iteration", agent: "Controlador", message: `🔄 Verificador solicitou melhorias — buscando mais dados...` });
    
    // Additional targeted search based on missing areas
    const additionalQueries = verification.missingAreas.slice(0, 3).map(area => 
      `"${name}" ${area}`
    );
    
    for (const q of additionalQueries) {
      const moreUrls = await searchDuckDuckGo(q);
      const existingUrls = extractedTexts.map(t => t.title);
      for (const url of moreUrls.slice(0, 3)) {
        const r = await extractTextFromUrl(url);
        if (r && !existingUrls.includes(r.title)) {
          extractedTexts.push(r);
          send({ step: "agent_researcher_extract", agent: "Pesquisador", message: `✓ Nova fonte: ${r.title.substring(0, 50)}`, chars: r.content.length });
        }
      }
    }
  }

  // ── PHASE 4: Create brain + save texts ──
  send({ step: "saving", agent: "Controlador", message: `💾 Criando cérebro e salvando ${extractedTexts.length} fontes...` });

  const { data: brain, error: brainErr } = await supabase
    .from("brains")
    .insert({
      name,
      type: "person_clone",
      user_id: userId,
      description: `Clone avançado de ${name} — gerado por Squad de Agentes IA`,
      tags: [name.toLowerCase(), "auto-clone", "squad"],
    })
    .select("id")
    .single();

  if (brainErr || !brain) {
    send({ step: "error", message: `Erro ao criar cérebro: ${brainErr?.message || "desconhecido"}` });
    return;
  }

  // Save texts in parallel
  await Promise.all(extractedTexts.map(t =>
    supabase.from("brain_texts").insert({
      brain_id: brain.id,
      content: t.content,
      source_type: "auto_clone",
      file_name: t.title,
    })
  ));

  // Save the DNA report as a special text
  if (report.length > 100) {
    await supabase.from("brain_texts").insert({
      brain_id: brain.id,
      content: report,
      source_type: "auto_clone",
      file_name: `[DNA Cognitivo] Relatório de ${name}`,
      category: "analysis",
    });
  }

  // ── PHASE 5: Generate System Prompt ──
  const rawContent = extractedTexts.map(t => t.content).join("\n\n---\n\n");
  const systemPrompt = await agentPrompter(name, report, rawContent, apiKey, send);

  if (systemPrompt && systemPrompt.length > 200) {
    await supabase.from("brains").update({ system_prompt: systemPrompt }).eq("id", brain.id);
    send({ step: "prompt_done", agent: "Prompter", message: `✅ Sistema Operacional Cognitivo aplicado ao clone` });
  } else {
    send({ step: "prompt_warning", agent: "Prompter", message: `⚠️ Prompt gerado parcialmente — refine na aba Prompt` });
  }

  // ── DONE ──
  send({ step: "done", brainId: brain.id, message: `🧠 Clone de "${name}" criado com sucesso pelo Squad de Agentes!` });
}

// ══════════════════════════════════════════════════════════════════════════
//  HTTP Handler
// ══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await getUserId(authHeader);
    const { name, urls, brainName } = await req.json();

    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
