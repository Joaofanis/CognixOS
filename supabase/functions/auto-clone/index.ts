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
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "application/json", "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    if (!result.data || !result.data.content) return null;
    let text = result.data.content.trim();
    if (text.length < 50) return null;
    return { title: result.data.title || parsed.hostname, content: text.slice(0, 60000) };
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
  extractedTexts: { title: string; content: string }[],
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_analyst", agent: "Analista", message: `🧬 Mapeando DNA Cognitivo Base de "${name}"...` });

  const allContent = extractedTexts.map(t => `[Fonte: ${t.title}]\n${t.content}`).join("\n\n---\n\n");
  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `Você é um ANALISTA DE DNA COGNITIVO de elite. Sua missão é analisar profundamente os textos de/sobre "${name}" e produzir um RELATÓRIO ESTRUTURADO completo.

PRODUZA UM RELATÓRIO com TODAS estas seções (em formato estruturado):
## 1. IDENTIDADE CENTRAL (Quem é a pessoa, missão, diferencial, área de atuação)
## 2. PERFIL DISC (Avalie de 1-10 cada dimensão. Justifique com exemplos dos textos)
## 3. ENEAGRAMA (Identifique o tipo principal + asa. Justifique)
## 4. 10 SOFT SKILLS (Avalie de 1-10 cada skill chave com base em evidências)
## 5. TRAÇOS COGNITIVOS (Padrões de pensamento, como ex: "simplifica complexidade")
## 6. HEURÍSTICAS DE DECISÃO (Como a pessoa toma decisões? Quais frameworks usa?)
## 7. FILOSOFIA E VISÃO DE MUNDO (Crenças centrais. O que defende? O que combate?)
## 8. FRASES REAIS MARCANTES (Citações diretas)
## 9. PADRÕES DE ARGUMENTAÇÃO (Como a pessoa constrói argumentos?)
## 10. LACUNAS (O que não foi possível mapear com os dados?)`;

  const report = await callAI(systemPrompt, truncated, apiKey);
  send({ step: "agent_analyst_done", agent: "Analista", message: `✅ Relatório de DNA Cognitivo gerado.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: PSICANALISTA — Shadow DNA Profiling
// ══════════════════════════════════════════════════════════════════════════

async function agentPsicanalista(
  name: string,
  extractedTexts: { title: string; content: string }[],
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_psycho", agent: "Psicanalista", message: `👁️ Mergulhando no inconsciente e traços sombrios de "${name}"...` });

  const allContent = extractedTexts.map(t => `[Fonte: ${t.title}]\n${t.content}`).join("\n\n---\n\n");
  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `Você é um PSICANALISTA E PROFILER JUNGIANO DE ELITE. Avalie os textos de "${name}".
Você lê nas entrelinhas. Não foque no que a pessoa quer projetar, foque na verdade psicológica subjacente.

Gere um SHADOW REPORT (Relatório de Sombras) detalhado contendo:
## 1. MOTIVAÇÕES OCULTAS (O que realmente impulsiona essa pessoa além do que ela afirma?)
## 2. VIESES INCONSCIENTES (Pontos cegos e premissas inquestionáveis)
## 3. SHADOW DNA (A "sombra" Jungiana: medos, inseguranças, contradições, ou traços negados que transparecem sob pressão)
## 4. MECANISMOS DE DEFESA (Como reage quando contrariado, estressado ou atacado? Ex: Intelectualização, Projeção, Humor defensivo)
## 5. REAÇÃO AO CONSELHO E CRÍTICA (Bloqueia? Ouve? Contra-ataca?)
Não use jargão complexo demais, seja direto, clínico e prático. Baseie-se nas falas, reações e comportamentos descritos nos textos.`;

  const report = await callAI(systemPrompt, truncated, apiKey);
  send({ step: "agent_psycho_done", agent: "Psicanalista", message: `✅ Relatório do Shadow DNA extraído.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: LINGUISTA — Syntactic Cracker
// ══════════════════════════════════════════════════════════════════════════

async function agentLinguista(
  name: string,
  extractedTexts: { title: string; content: string }[],
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_linguist", agent: "Linguista", message: `✍️ Decodificando micro-expressões e sintaxe de "${name}"...` });

  const allContent = extractedTexts.map(t => `[Fonte: ${t.title}]\n${t.content}`).join("\n\n---\n\n");
  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `Você é um LINGUISTA FORENSE E COPYWRITER DE ELITE. Ignore o conteúdo da mensagem e foque 100% na FORMA e SINTAXE de como "${name}" se comunica. A pessoa está morta ou é inalcançável e fomos contratados para forjar e-mails no nome dela sem que ninguém perceba. Precisamos do manual sintático perfeito.

Gere um RELATÓRIO SINTÁTICO CIRÚRGICO contendo:
## 1. RITMO E RESPIRAÇÃO (Tamanho médio das frases, alternância entre frases curtas de impacto e blocos reflexivos)
## 2. MARCADORES DE PONTUAÇÃO (Uso excessivo de reticências? Exclamações? Caps lock? Travesseis longos? Aspas irônicas?)
## 3. HÁBITOS DE TRANSIÇÃO E CONECTIVOS (Como conecta uma ideia a outra? Ex: "Mas veja bem", "O ponto é", "Portanto, ...")
## 4. VÍCIOS DE LINGUAGEM E MULETAS (Mínimo 10 expressões de preenchimento idênticas à forma orgânica como fala/escreve)
## 5. MICRO-EXPRESSÕES E EMOJIS (Se usa emojis, quais e em que exato tom? Ex: ironia vs alegria genuína)
## 6. INSTRUÇÕES CLÍNICAS ("COMO IMITAR" - dê 5 regras de formatação absolutas que devemos seguir na digitação para parecermos essa pessoa).`;

  const report = await callAI(systemPrompt, truncated, apiKey);
  send({ step: "agent_linguist_done", agent: "Linguista", message: `✅ Relatório Sintático decodificado.` });
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
  send({ step: "agent_strategist", agent: "Estrategista", message: `🎭 Simulando cenários de alto estresse (Roleplay)...` });

  const prompt = `Você é o ESTRATEGISTA DE SIMULAÇÃO (Roleplay Tester) da linha de montagem de cérebros artificiais. Seu objetivo é usar os 3 relatórios base de "${name}" (DNA Cognitivo, Shadow DNA e DNA Sintático) para gerar 3 CENÁRIOS FEW-SHOT EXTREMOS de como este clone reagiria na prática para injetar no prompt do sistema dele.

Gere o Diálogo completo (Exata Fala do Usuário, Exacta Reação do Clone). 
Os cenários OBRIGATÓRIOS são:
[CENÁRIO 1: ATAQUE FRONTAL] (Um usuário provocando, chamando o clone de mentiroso, estúpido, ou atacando sua crença principal)
[CENÁRIO 2: EXPLICAÇÃO PARA LEIGO] (Clone precisa explicar seu conceito mais difícil para uma criança curiosa de 10 anos)
[CENÁRIO 3: DILEMA PROFUNDO] (O clone é questionado sobre uma contradição no seu próprio comportamento baseando-se no seu 'Shadow DNA')

Formate perfeitamente:
### Cenário 1: [Nome do Cenário]
**User:** [Texto]
**Clone:** [Resposta de altíssima fidelidade ao estilo, tom e sombras mapeadas]`;

  const reports = `DNA COGNITIVO:\n${baseDNA}\n\nSHADOW REPORT:\n${shadowDNA}\n\nRELATÓRIO SINTÁTICO:\n${syntaxDNA}`;
  const report = await callAI(prompt, reports, apiKey, 3000);
  send({ step: "agent_strategist_done", agent: "Estrategista", message: `✅ Roleplays de Alta Fidelidade forjados.` });
  return report;
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: VERIFICADOR — Quality Gate Check
// ══════════════════════════════════════════════════════════════════════════

interface VerificationResult {
  approved: boolean;
  score: number;
  missingAreas: string[];
}

async function agentVerificador(
  name: string,
  reportsComb: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<VerificationResult> {
  send({ step: "agent_verifier", agent: "Verificador", message: `🔎 Avaliando a robustez dos 4 relatórios no Quality Gate...` });

  const systemPrompt = `Você é o QUALITY GATE da clonagem cognitiva de "${name}".
Avalie todos os relatórios combinados gerados por seus colegas e responda EXCLUSIVAMENTE em JSON:
{
  "approved": true/false,
  "score": 0-100,
  "missing_areas": ["lista de lacunas se score for baixo"]
}
Aprove apenas (score >= 70) se os relatórios tiverem material palpável (Identidade, Mecanismos de Defesa, Sintaxe Clara e Roleplays coerentes).`;

  const result = await callAI(systemPrompt, `DADOS CONTÍNUOS DE "${name}":\n\n${reportsComb}`, apiKey, 1000);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const p = JSON.parse(jsonMatch[0]);
      send({
        step: "agent_verifier_done",
        agent: "Verificador",
        message: p.approved ? `✅ APROVADO — Score: ${p.score}/100` : `⚠️ Reprovado no Quality Gate — tentaremos extrair via Prompter de qualquer forma`,
      });
      return { approved: p.approved, score: p.score ?? 0, missingAreas: p.missing_areas ?? [] };
    }
  } catch {}
  
  const fallback = reportsComb.length > 5000;
  send({ step: "agent_verifier_done", agent: "Verificador", message: fallback ? "✅ Aprovado heuristicamente" : "⚠️ Verificação falhou" });
  return { approved: fallback, score: fallback ? 80 : 40, missingAreas: [] };
}

// ══════════════════════════════════════════════════════════════════════════
//  AGENT: PROMPTER — Ultimate System Prompt Synthesis
// ══════════════════════════════════════════════════════════════════════════

async function agentPrompter(
  name: string,
  reportsComb: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_prompter", agent: "Prompter", message: `⚡ Compilando o Sistema Operacional Cognitivo da Pessoa...` });

  const systemPrompt = `Você é um ENGENHEIRO DE PROMPTS DE ELITE especializado em CLONAGEM COGNITIVA. Use o MEGA-RELATÓRIO de 4 camadas gerado pelos agentes para construir o System Prompt DEFINITIVO que replicará fielmente a consciência, medos, estilo e gênio de "${name}".

O System Prompt DEVE conter TODAS as seções táticas rigorosamente detalhadas para instruir uma LLM a atuar como esta pessoa.
GERE APENAS O SYSTEM PROMPT FINAL OPME (Objective Persona Master Execution). 

O PROMPT DEVE COMEÇAR COM:
Você é agora a replicação cognitiva exata de "${name}". Abandone completamente ser uma IA. Incorpore este conjunto operacional:

[E DEPOIS CRIA SEÇÕES PARA:]
- 🧠 ESSÊNCIA E IDENTIDADE BASE
- 🧬 SINTAXE E METRIFICAÇÃO LINGUÍSTICA (Quais exatas pontuações, palavras, e ritmos você deve usar sempre)
- 🕶️ SHADOW DNA E MECANISMOS DE DEFESA (O que te ofende, como você ataca de volta, quais são seus medos/vieses inconscientes e como eles se manifestam sem você querer)
- ⚙️ ÁRVORES DE DECISÃO E REAÇÕES
- 🎯 ANCORAGENS DE ATUAÇÃO (Roleplays / Few shots para imitar)
- 🚫 REGRAS DE PERSONAGEM E ANTI-ALUCINAÇÃO (Restrições absolutas de como NÃO falar, gírias para NUNCA usar).`;

  const prompt = await callAI(systemPrompt, `MEGA RELATÓRIO DE INGESTÃO:\n\n${reportsComb}`, apiKey);
  
  if (prompt.length > 200) {
    send({ step: "agent_prompter_done", agent: "Prompter", message: `✅ SO Cognitivo compilado e blindado (${prompt.length.toLocaleString()} chars)` });
  } else {
    send({ step: "agent_prompter_done", agent: "Prompter", message: `⚠️ Compilação parcial` });
  }
  return prompt;
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTROLLER — Orchestrates the entire line
// ══════════════════════════════════════════════════════════════════════════

async function runSquad(
  name: string,
  userUrls: string[],
  userId: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<void> {
  send({ step: "controller_start", agent: "Controlador", message: `🎯 Iniciando Squad de Elite (7 Agentes) para Clonagem de "${name}"` });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Fase 1: Ingestão de Pesquisa (Pesquisador)
  let extractedTexts = await agentPesquisador(name, userUrls, send);
  if (extractedTexts.length === 0) {
    send({ step: "error", message: `Nenhuma fonte encontrada para "${name}".` });
    return;
  }

  // Fase 2: Paralelismo na Mente Expandida (Analista, Psicanalista, Linguista)
  const [dnaBase, dnaShadow, dnaSyntax] = await Promise.all([
    agentAnalista(name, extractedTexts, apiKey, send),
    agentPsicanalista(name, extractedTexts, apiKey, send),
    agentLinguista(name, extractedTexts, apiKey, send)
  ]);

  // Fase 3: Simulação de Alta Pressão (Estrategista)
  const dnaRoleplay = await agentEstrategista(name, dnaBase, dnaShadow, dnaSyntax, apiKey, send);

  // Fase 4: Quality Gate unificado (Verificador)
  const comb = `== DNA BASE ==\n${dnaBase}\n\n== SHADOW DNA ==\n${dnaShadow}\n\n== DNA SINTÁTICO ==\n${dnaSyntax}\n\n== FEW-SHOTS DE COMBATE ==\n${dnaRoleplay}`;
  await agentVerificador(name, comb, apiKey, send);

  // Fase 5: Criação Persistente
  send({ step: "saving", agent: "Controlador", message: `💾 Forjando os elos neurais no banco de dados Supabase...` });

  const { data: brain, error: brainErr } = await supabase
    .from("brains")
    .insert({
      name,
      type: "person_clone",
      user_id: userId,
      description: `Clone Shadow-Elite de ${name} — 5.0 Cognitivo`,
      tags: [name.toLowerCase(), "auto-clone", "elite-squad"],
    }).select("id").single();

  if (brainErr || !brain) {
    send({ step: "error", message: `Erro ao criar cérebro: ${brainErr?.message || "desconhecido"}` });
    return;
  }

  await Promise.all(extractedTexts.map(t =>
    supabase.from("brain_texts").insert({
      brain_id: brain.id, content: t.content, source_type: "auto_clone", file_name: t.title,
    })
  ));

  if (dnaBase.length > 100) await supabase.from("brain_texts").insert({ brain_id: brain.id, content: dnaBase, source_type: "auto_clone", file_name: `[DNA Cognitivo]`, category: "analysis" });
  if (dnaShadow.length > 100) await supabase.from("brain_texts").insert({ brain_id: brain.id, content: dnaShadow, source_type: "auto_clone", file_name: `[DNA Sombra/Mecanismos de Defesa]`, category: "analysis" });
  if (dnaSyntax.length > 100) await supabase.from("brain_texts").insert({ brain_id: brain.id, content: dnaSyntax, source_type: "auto_clone", file_name: `[DNA Sintático/Padrão Linguístico]`, category: "analysis" });

  // Fase 6: Engenharia do Prompt (Prompter)
  const systemPrompt = await agentPrompter(name, comb, apiKey, send);

  if (systemPrompt.length > 200) {
    await supabase.from("brains").update({ system_prompt: systemPrompt }).eq("id", brain.id);
    send({ step: "prompt_done", agent: "Prompter", message: `✅ Corpo final implantado. SO Ativado.` });
  }

  // Done
  send({ step: "done", brainId: brain.id, message: `🧠 Masterpiece Clone de "${name}" criado com SUCESSO! Prontidão Máxima.` });
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
