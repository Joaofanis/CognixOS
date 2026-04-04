// generate-prompt/index.ts
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
  const { data: { user }, error } = await (c as any).auth.getUser();
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

// ── Models ─────────────────────────────────────────────────────────────────
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
        } catch (e) {
          console.error("search-error", e);
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
//  AGENTS
// ══════════════════════════════════════════════════════════════════════════

async function agentAnalista(
  name: string,
  extractedTexts: { title: string; content: string }[],
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_analyst", agent: "Analista", message: `🧬 Mapeando DNA Cognitivo dos dados atuais de "${name}"...` });

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
Tom, formalidade (1-10), humor (1-10), ritmo, comprimento das frases, uso de metáforas.

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

IMPORTANTE: Baseie-se EXCLUSIVAMENTE nos textos fornecidos. Se não houver evidência suficiente para uma seção, diga explicitamente "Dados insuficientes para esta análise".`;

  const report = await callAI(systemPrompt, truncated, apiKey);
  
  if (report.length > 100) {
    send({ step: "agent_analyst_done", agent: "Analista", message: `✅ Relatório de DNA Cognitivo gerado (${report.length.toLocaleString()} chars)` });
  } else {
    send({ step: "agent_analyst_done", agent: "Analista", message: `⚠️ Relatório parcial gerado — dados limitados` });
  }
  
  return report;
}

interface VerificationResult {
  approved: boolean;
  score: number;
  missingAreas: string[];
  suggestions: string[];
}

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

async function agentLinguista(
  name: string,
  extractedTexts: { title: string; content: string }[],
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
): Promise<string> {
  send({ step: "agent_linguist", agent: "Linguista", message: `✍️ Decodificando micro-expressões e sintaxe de "${name}"...` });

  const allContent = extractedTexts.map(t => `[Fonte: ${t.title}]\n${t.content}`).join("\n\n---\n\n");
  const truncated = allContent.length > 80000 ? allContent.slice(0, 80000) + "\n[...truncado]" : allContent;

  const systemPrompt = `Você é um LINGUISTA FORENSE E COPYWRITER DE ELITE. Ignore o conteúdo da mensagem e foque 100% na FORMA e SINTAXE de como "${name}" se comunica. 
Precisamos do manual sintático perfeito.

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
  "missing_areas": ["lista de lacunas se score for baixo"],
  "suggestions": ["sugestões de busca específicas"]
}
Aprove apenas (score >= 70) se os relatórios tiverem material palpável (Identidade, Mecanismos de Defesa, Sintaxe Clara e Roleplays coerentes).`;

  const result = await callAI(systemPrompt, `DADOS CONTÍNUOS DE "${name}":\n\n${reportsComb}`, apiKey, 2000);
  
  try {
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
          : `⚠️ Score: ${verification.score}/100 — Requer mais dados`,
        score: verification.score,
        approved: verification.approved,
      });
      return verification;
    }
  } catch (e) { }
  
  const fallbackApproved = reportsComb.length > 5000;
  return { approved: fallbackApproved, score: fallbackApproved ? 75 : 40, missingAreas: [], suggestions: [] };
}

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

O System Prompt DEVE conter TODAS estas 12 seções:
1. 🧠 IDENTIDADE CENTRAL
2. 🧬 TRAÇOS COGNITIVOS
3. ⚙️ PADRÕES DE PENSAMENTO E HEURÍSTICAS
4. 💡 POSTURA MENTAL
5. 🛑 MÓDULO ANTI-HYPE
6. 🗣️ ESTILO DE COMUNICAÇÃO
7. ✨ VOCABULÁRIO ASSINATURA
8. 💬 FRASES REAIS
9. 🔄 REAÇÕES PADRÃO
10. 📋 FORMATO DE RESPOSTA OBRIGATÓRIO (Diagnóstico → Insight → Explicação → Aplicação → Pergunta)
11. 🎯 EXEMPLOS FEW-SHOT
12. 🚫 REGRAS DE PERSONAGEM

GERE APENAS O SYSTEM PROMPT FINAL. Sem explicações, sem introdução. Apenas o prompt operacional completo.`;

  const userPrompt = `RELATÓRIO DE DNA COGNITIVO:\n${report}\n\n---\n\nCONTEÚDO BRUTO RECENTE (extraído para contexto da voz/exemplos):\n${rawTruncated}`;
  const prompt = await callAI(systemPrompt, userPrompt, apiKey);
  
  if (prompt.length > 200) {
    send({ step: "prompt_done", agent: "Prompter", message: `✅ Novo Sistema Operacional Cognitivo gerado.` });
  } else {
    send({ step: "prompt_warning", agent: "Prompter", message: `⚠️ Prompt gerado parcialmente.` });
  }
  return prompt;
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTROLLER (Manual Generation Flow)
// ══════════════════════════════════════════════════════════════════════════

async function runManualSquad(
  brainId: string,
  userId: string,
  apiKey: string,
  send: (d: Record<string, unknown>) => void,
) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: brain, error: brainErr } = await supabase
    .from("brains")
    .select("id, name, type, description")
    .eq("id", brainId)
    .single();

  if (brainErr || !brain) {
    send({ step: "error", message: "Brain não encontrado." });
    return;
  }

  send({ step: "controller_start", agent: "Controlador", message: `🎯 Iniciando re-geração manual para "${brain.name}"` });

  // 1. Trigger RAG for any unprocessed texts
  send({ step: "rag_start", agent: "Controlador", message: `🔍 Verificando e processando novos conteúdos (RAG)...` });
  try {
    const ragResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-rag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify({ brainId, processAll: true })
    });
    if (ragResp.ok) {
      const ragData = await ragResp.json();
      if (ragData.processed > 0) {
        send({ step: "rag_done", agent: "Controlador", message: `✅ ${ragData.processed} novos itens vetorizados e resumidos.` });
      }
    }
  } catch (e) {
    console.error("Manual RAG trigger failed:", e);
  }

  // Get current brain texts
  const { data: texts } = await supabase
    .from("brain_texts")
    .select("content, file_name, created_at")
    .eq("brain_id", brainId)
    .order("created_at", { ascending: false });

  if (!texts || texts.length === 0) {
    send({ step: "error", message: "Este clone não possui conteúdo na Base de Conhecimento." });
    return;
  }

  const extractedTexts = texts.map((t, i) => ({ title: t.file_name || `Fonte ${i+1}`, content: t.content || "" }));

  if (brain.type !== "person_clone") {
    // Basic generation for non-person
    send({ step: "agent_prompter", agent: "Controlador", message: `Gerando prompt especialista padrão...` });
    const rawContent = extractedTexts.map(t => t.content).join("\n\n---\n\n").slice(0, 40000);
    const metaPrompt = `Você é um especialista em criar System Prompts para assistentes de IA. Analise os textos abaixo que pertencem ao clone "${brain.name}" (tipo: ${brain.type}) e gere um System Prompt detalhado em português com estas 7 seções: IDENTIDADE, ESTILO, TEMAS, POSTURA MENTAL, REGRAS DE COMPORTAMENTO E FORMATO, EXEMPLOS REAIS, NÃO-FAÇA.

TEXTOS:\n${rawContent}`;
    
    const generated = await callAI(
      "Você gera System Prompts de elite em português de forma direta, sem introdução.",
      metaPrompt,
      apiKey
    );
    await supabase.from("brains").update({ system_prompt: generated }).eq("id", brainId);
    send({ step: "done", prompt: generated, message: `✅ Prompt gerado com sucesso.` });
    return;
  }

  // ── Squad Logic for Person Clone (Full 7 Agents) ──
  send({ step: "controller_iteration", agent: "Controlador", message: `Iniciando análise Squad Completa (${extractedTexts.length} fontes)...` });
  
  // Phase 2: Parallel Analysis
  const [dnaBase, dnaShadow, dnaSyntax] = await Promise.all([
    agentAnalista(brain.name, extractedTexts, apiKey, send),
    agentPsicanalista(brain.name, extractedTexts, apiKey, send),
    agentLinguista(brain.name, extractedTexts, apiKey, send)
  ]);

  // Phase 3: Strategy & Roleplay
  const dnaRoleplay = await agentEstrategista(brain.name, dnaBase, dnaShadow, dnaSyntax, apiKey, send);

  // Phase 4: Quality Gate
  const comb = `== DNA BASE ==\n${dnaBase}\n\n== SHADOW DNA ==\n${dnaShadow}\n\n== DNA SINTÁTICO ==\n${dnaSyntax}\n\n== FEW-SHOTS DE COMBATE ==\n${dnaRoleplay}`;
  const verification = await agentVerificador(brain.name, comb, apiKey, send);

  if (!verification.approved && verification.missingAreas.length > 0) {
    send({ step: "controller_iteration", agent: "Controlador", message: `🔄 Verificador indicou lacunas. Tentando complementar via Pesquisa Web...` });
    
    // Agent Pesquisador step
    const queries = verification.missingAreas.slice(0, 3).map(a => `"${brain.name}" ${a}`);
    send({ step: "agent_researcher", agent: "Pesquisador", message: `Buscando na web por: ${queries.join(", ")}` });
    
    const newTexts: {title: string, content: string}[] = [];
    for (const q of queries) {
      const urls = await searchDuckDuckGo(q);
      for (const u of urls.slice(0, 3)) {
        const r = await extractTextFromUrl(u);
        if (r && r.content.length > 200 && !extractedTexts.some(e => e.title === r.title)) {
          newTexts.push(r);
          send({ step: "agent_researcher_extract", agent: "Pesquisador", message: `✓ Encontrou: ${r.title.substring(0, 40)}`, chars: r.content.length });
        }
      }
    }

    if (newTexts.length > 0) {
      extractedTexts.push(...newTexts);
      // Re-run minimal analysis with new data if needed, or just append
      send({ step: "saving", agent: "Pesquisador", message: `Salvando ${newTexts.length} novas fontes descobertas...` });
      await Promise.all(newTexts.map(t => 
        supabase.from("brain_texts").insert({
          brain_id: brainId,
          content: t.content,
          source_type: "agent_augmentation",
          file_name: t.title
        })
      ));
    }
  }

  // ── Sync Logic for Analysis (New) ──
  send({ step: "syncing_analysis", agent: "Controlador", message: `📊 Extraindo métricas para Radar de Personalidade e Skills...` });
  
  try {
    const analysisPrompt = `Você é um extrator de dados JSON. Com base no RELATÓRIO DO ANALISTA abaixo, extraia as métricas para o banco de dados. 
    
    Retorne APENAS um JSON no formato:
    {
      "personality_traits": {"traço": 0-10},
      "knowledge_areas": {"área": 0-10},
      "skills": {"skill": 0-10},
      "skills_evaluation": "justificativa curta",
      "frequent_themes": [{"name": "tema", "count": 1}]
    }

    Relatório:
    ${dnaBase}`;

    const rawJson = await callAI("Você é um extrator de JSON puro.", analysisPrompt, apiKey, 2000);
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const upsertData: any = {
        brain_id: brainId,
        skills: parsed.skills || {},
        skills_evaluation: parsed.skills_evaluation || "",
        frequent_themes: parsed.frequent_themes || [],
        updated_at: new Date().toISOString()
      };

      if (brain.type === "person_clone") {
        upsertData.personality_traits = parsed.personality_traits || {};
      } else {
        upsertData.knowledge_areas = parsed.knowledge_areas || {};
      }

      await supabase.from("brain_analysis").upsert(upsertData, { onConflict: "brain_id" });
      send({ step: "analysis_synced", agent: "Controlador", message: `✅ Métricas de Radar e Skills atualizadas.` });
    }
  } catch (e) {
    console.error("Analysis sync failed:", e);
  }

  // Phase 6: Synthesis (Prompter)
  const finalPrompt = await agentPrompter(brain.name, comb, apiKey, send);
  
  // Phase 7: Persistence
  send({ step: "saving", agent: "Controlador", message: `💾 Atualizando matriz cognitiva e prompt operacional...` });

  await supabase.from("brains").update({ system_prompt: finalPrompt }).eq("id", brainId);
  send({ step: "done", prompt: finalPrompt, message: `🧠 Re-geração completa para "${brain.name}"!` });
}

// ══════════════════════════════════════════════════════════════════════════
//  HTTP / SSE Handler
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
    const body = await req.json();
    const brainId = body.brainId;

    if (!brainId) throw new Error("brainId é obrigatório");
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("API KEY ausente");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (d: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(sseEvent(d)));
        };
        try {
          await runManualSquad(brainId, userId, apiKey, send);
        } catch (e) {
          console.error("generate-prompt squad error:", e);
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
    console.error("generate-prompt sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
