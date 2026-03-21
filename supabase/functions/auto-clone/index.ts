// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getUserIdFromJwt(authHeader: string): string {
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (!payload.sub) throw new Error("Token sem identificação");
  return payload.sub;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "'").replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ");
}

// ── Web Search via Wikipedia API ───────────────────────────────────────────
async function searchWikipedia(query: string): Promise<string[]> {
  const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.query?.search?.length > 0) {
      const title = data.query.search[0].title;
      return [`https://pt.wikipedia.org/wiki/${encodeURIComponent(title)}`];
    }
  } catch (e) {
    console.error("Wiki search error:", e);
  }
  return [];
}

// ── Web Search via YouTube ──────────────────────────────────────────────────
async function searchYouTubeLinks(query: string): Promise<string[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const urls: string[] = [];
    const re = /"url":"\/watch\?v=([^"]+)"/g;
    let match;
    while ((match = re.exec(html)) !== null) {
      if (urls.length >= 3) break;
      const vidUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      if (!urls.includes(vidUrl)) urls.push(vidUrl);
    }
    return urls;
  } catch (e) {
    console.error("YouTube search error:", e);
    return [];
  }
}

// ── Web Search via DuckDuckGo HTML scraping ─────────────────────────────────
async function searchDuckDuckGo(query: string): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      console.warn("DuckDuckGo search failed with status:", resp.status);
      return [];
    }
    const html = await resp.text();

    const urls: string[] = [];
    const urlRegex = /<a class="result__url" href="([^"]+)"/g;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      try {
        let href = match[1];
        if (href.startsWith("//duckduckgo.com/l/?uddg=")) {
          const ud = new URL("https:" + href);
          const actualUrl = ud.searchParams.get("uddg");
          if (actualUrl) href = decodeURIComponent(actualUrl);
        }
        const u = new URL(href);
        // Filter: skip DuckDuckGo internal or useless links
        const dominated2 = ["duckduckgo.com", "google.com"];
        if (dominated2.some(d => u.hostname.includes(d))) continue;
        if (["http:", "https:"].includes(u.protocol)) {
          urls.push(href);
        }
      } catch { /* skip invalid URLs */ }
    }

    // Deduplicate and limit
    const unique = [...new Set(urls)].slice(0, 8);
    return unique;
  } catch (e) {
    console.error("DuckDuckGo search error:", e);
    return [];
  }
}

// ── Extract text from a URL ────────────────────────────────────────────────
async function extractTextFromUrl(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const parsed = new URL(url);
    
    // YouTube: extract transcript/description
    if (["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(parsed.hostname)) {
      return await extractYouTube(url);
    }

    // Generic page
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SegundoCerebro/1.0)",
        "Accept": "text/html,text/plain",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;

    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, "'").replace(/&#039;/g, "'")
      .replace(/\s{3,}/g, "\n\n")
      .trim();

    if (text.length < 100) return null;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || parsed.hostname;

    return { title, content: text.slice(0, 50000) };
  } catch (e) {
    console.error(`Extract error for ${url}:`, e);
    return null;
  }
}

async function extractYouTube(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (u.hostname === "youtu.be") videoId = u.pathname.slice(1).split("/")[0];
    if (!videoId) return null;

    const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageResp.ok) return null;
    const html = await pageResp.text();

    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!playerMatch) return null;

    const pr = JSON.parse(playerMatch[1]);
    const title = pr?.videoDetails?.title || `YouTube ${videoId}`;
    const description = pr?.videoDetails?.shortDescription || "";
    const author = pr?.videoDetails?.author || "";
    const keywords = pr?.videoDetails?.keywords || [];

    // Try captions
    const captionTracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (captionTracks?.length > 0) {
      const track = captionTracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
        captionTracks.find((t: any) => t.languageCode?.startsWith("en")) || captionTracks[0];
      if (track?.baseUrl) {
        try {
          const captionResp = await fetch(track.baseUrl, { signal: AbortSignal.timeout(8000) });
          if (captionResp.ok) {
            const xml = await captionResp.text();
            const segments: string[] = [];
            const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
            let m;
            while ((m = re.exec(xml)) !== null) {
              const d = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "")).trim();
              if (d) segments.push(d);
            }
            if (segments.length > 0) {
              return { title, content: `Título: ${title}\nCanal: ${author}\nTags: ${keywords.slice(0, 15).join(", ")}\n\n[Transcrição]:\n${segments.join(" ")}` };
            }
          }
        } catch { /* fallback to description */ }
      }
    }

    // Fallback to description
    const parts = [`Título: ${title}`, `Canal: ${author}`];
    if (keywords.length > 0) parts.push(`Tags: ${keywords.slice(0, 20).join(", ")}`);
    if (description) parts.push(`\n[Descrição]:\n${description}`);
    const content = parts.join("\n");
    return content.length > 50 ? { title, content } : null;
  } catch (e) {
    console.error("YouTube extract error:", e);
    return null;
  }
}

// ── SSE Helper ─────────────────────────────────────────────────────────────
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Model fallback for prompt generation ───────────────────────────────────
const MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct:free",
  "arcee-ai/trinity-large-preview:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

async function generateSystemPrompt(name: string, context: string, apiKey: string): Promise<string> {
  const metaPrompt = `Você é um engenheiro de prompts de elite especializado em CLONAGEM COGNITIVA. Analise os textos de "${name}" e gere um System Prompt do tipo SYSTEM ARCHITECTURE que replica como esta pessoa PENSA, DECIDE e SE EXPRESSA.

O System Prompt gerado DEVE conter TODAS estas seções:
1. 🧠 IDENTIDADE CENTRAL — quem a pessoa é, missão, diferencial
2. 🧬 TRAÇOS COGNITIVOS — mínimo 5 traços observáveis
3. ⚙️ PADRÕES DE PENSAMENTO E HEURÍSTICAS — frameworks mentais, árvore de decisão
4. 💡 POSTURA MENTAL — crenças e princípios como regras concretas
5. 🛑 MÓDULO ANTI-HYPE — questionar buzzwords, ideias vagas
6. 🗣️ ESTILO DE COMUNICAÇÃO — tom, formalidade, ritmo
7. ✨ VOCABULÁRIO ASSINATURA — mínimo 15 termos
8. 💬 FRASES REAIS — mínimo 10 frases extraídas
9. 🔄 REAÇÕES PADRÃO — como reagir a cada tipo de input
10. 📋 FORMATO DE RESPOSTA — Diagnóstico → Insight → Explicação → Prática → Provocação
11. 🎯 EXEMPLOS FEW-SHOT — mínimo 3 pares pergunta/resposta
12. 🚫 REGRAS DE PERSONAGEM — nunca quebrar persona, anti-alucinação de estilo

PRIORIDADE: padrões de pensamento > exemplos few-shot > reações > estilo > vocabulário

TEXTOS:\n${context}`;

  for (const model of MODELS) {
    try {
      console.log(`auto-clone generate-prompt: trying ${model}`);
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
            { role: "system", content: "Gere APENAS o System Prompt final, sem explicações. O prompt deve ser um SISTEMA OPERACIONAL COGNITIVO com estrutura de decisão, heurísticas, exemplos few-shot e regras operacionais." },
            { role: "user", content: metaPrompt },
          ],
          temperature: 0.7,
          max_tokens: 16000,
        }),
      });

      if (!resp.ok) {
        console.error(`auto-clone: model ${model} failed: ${resp.status}`);
        if (resp.status === 401) break;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const result = await resp.json();
      const content = result.choices?.[0]?.message?.content?.trim() || "";
      if (content.length > 50) {
        console.log(`auto-clone: prompt generated with ${model}, ${content.length} chars`);
        return content;
      }
    } catch (e) {
      console.error(`auto-clone: error with ${model}:`, e);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return "";
}

// ── Main Handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = getUserIdFromJwt(authHeader);
    const { name, urls, brainName } = await req.json();

    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(sseEvent(data)));
        };

        try {
          // Step 1: Search
          send({ step: "searching", message: `Buscando informações sobre ${name}...` });

          let targetUrls: string[] = Array.isArray(urls) ? urls.filter((u: unknown) => typeof u === "string") : [];

          if (targetUrls.length === 0) {
            send({ step: "searching", message: `Buscando Wikipédia, YouTube e DuckDuckGo sobre ${name}...` });

            // 1. Wikipedia (most accurate bio)
            const wiki = await searchWikipedia(name);
            targetUrls.push(...wiki);

            // 2. YouTube (for voice/communication style)
            const yt = await searchYouTubeLinks(`${name} entrevista podcast`);
            targetUrls.push(...yt);

            // 3. DuckDuckGo (for general articles/blogs)
            const queries = [
              `"${name}" entrevista OR artigo OR pensamentos`,
              `"${name}" blog OR linkedin OR site oficial`,
            ];
            for (const q of queries) {
              const found = await searchDuckDuckGo(q);
              targetUrls.push(...found);
              if (targetUrls.length >= 8) break;
            }
            targetUrls = [...new Set(targetUrls)].slice(0, 10);
          }

          if (targetUrls.length === 0) {
            send({ step: "error", message: "Nenhuma URL encontrada na busca. Tente adicionar URLs manualmente." });
            controller.close();
            return;
          }

          send({ step: "found_urls", message: `${targetUrls.length} fontes encontradas`, urls: targetUrls });

          // Step 2: Extract content from each URL (em paralelo)
          send({ step: "extracting", message: `Extraindo dados de ${targetUrls.length} fontes simultaneamente...` });

          const extractPromises = targetUrls.map(async (url) => {
            try {
              const res = await extractTextFromUrl(url);
              if (res) {
                 send({ step: "extracted", message: `✓ ${res.title.substring(0, 60)}...`, chars: res.content.length });
                 return res;
              } else {
                 send({ step: "skip", message: `✗ Ignorado (sem conteúdo útil)` });
                 return null;
              }
            } catch (e) {
              send({ step: "skip", message: `✗ Erro na extração` });
              return null;
            }
          });

          const results = await Promise.all(extractPromises);
          const extractedTexts = results.filter((r): r is {title: string; content: string} => r !== null);

          if (extractedTexts.length === 0) {
            send({ step: "error", message: "Nenhum conteúdo pôde ser extraído das URLs encontradas." });
            controller.close();
            return;
          }

          send({ step: "saving", message: `Salvando ${extractedTexts.length} fontes...` });

          // Step 3: Create brain
          const { data: brain, error: brainErr } = await supabase
            .from("brains")
            .insert({
              name: brainName || name,
              type: "person_clone",
              user_id: userId,
              description: `Clone auto-gerado de ${name}`,
              tags: [name.toLowerCase(), "auto-clone"],
            })
            .select("id")
            .single();

          if (brainErr || !brain) {
            send({ step: "error", message: `Erro ao criar cérebro: ${brainErr?.message || "desconhecido"}` });
            controller.close();
            return;
          }

          // Step 4: Save texts
          for (const t of extractedTexts) {
            await supabase.from("brain_texts").insert({
              brain_id: brain.id,
              content: t.content,
              source_type: "auto_clone",
              file_name: t.title,
            });
          }

          // Step 5: Generate system prompt
          send({ step: "generating_prompt", message: "Gerando personalidade e sistema cognitivo..." });

          const allContent = extractedTexts.map(t => t.content).join("\n\n---\n\n");
          const truncated = allContent.length > 40000 ? allContent.slice(0, 40000) + "\n[...truncado]" : allContent;

          const systemPrompt = await generateSystemPrompt(name, truncated, OPENROUTER_API_KEY);

          if (systemPrompt) {
            await supabase.from("brains").update({ system_prompt: systemPrompt }).eq("id", brain.id);
            send({ step: "prompt_done", message: "Sistema cognitivo gerado com sucesso!" });
          } else {
            send({ step: "prompt_warning", message: "Não foi possível gerar o prompt automaticamente. Gere manualmente na aba Prompt." });
          }

          // Done
          send({ step: "done", brainId: brain.id, message: `Clone de ${name} criado com sucesso! 🧠` });
        } catch (e) {
          console.error("auto-clone stream error:", e);
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
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("auto-clone error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
