// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Auth ────────────────────────────────────────────────────────────────────
async function getUserIdFromJwt(authHeader: string): Promise<string> {
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (!payload.sub) throw new Error("Token sem identificação");
  return payload.sub;
}

// ── HTML Decoder ─────────────────────────────────────────────────────────────
function decodeHtml(t: string): string {
  return t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ");
}

// ── Video ID Extraction (supports all YouTube URL formats) ───────────────────
function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^m\./, "");
    // youtu.be/ID
    if (hostname === "youtu.be") return u.pathname.split("/")[1]?.split("?")[0] || null;
    // youtube.com/shorts/ID, /live/ID, /v/ID, /embed/ID
    const pathParts = u.pathname.split("/").filter(Boolean);
    if (["shorts", "live", "v", "embed"].includes(pathParts[0])) {
      return pathParts[1]?.split("?")[0] || null;
    }
    // youtube.com/watch?v=ID
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

// ── Method 1: youtubetranscript.com API (no IP blocking) ─────────────────────
async function fetchTranscriptViaApi(videoId: string): Promise<{ title: string; transcript: string } | null> {
  try {
    // This public API proxies YouTube captions and is not rate-limited by IP
    const res = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    if (!xml.includes("<text")) return null;

    const segs: string[] = [];
    const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const d = decodeHtml(m[1].replace(/<[^>]+>/g, "")).trim();
      if (d) segs.push(d);
    }
    if (segs.length === 0) return null;
    const finalTranscript = segs.join(" ").replace(/\s{2,}/g, " ").trim();
    
    // Check for common error messages returned as transcript
    const lower = finalTranscript.toLowerCase();
    if (
      lower.includes("pedimos desculpas") || 
      lower.includes("youtube está bloqueando") ||
      lower.includes("could not retrieve a transcript") ||
      lower.includes("disabled")
    ) {
      console.log(`[import-url-v2] Layer 1 returned error message disguised as transcript: ${finalTranscript}`);
      return null;
    }
    
    return { title: `YouTube ${videoId}`, transcript: finalTranscript };
  } catch {
    return null;
  }
}

// ── Method 2: Direct scraping of ytInitialPlayerResponse ────────────────────
async function fetchTranscriptViaScraping(videoId: string): Promise<{ title: string; transcript: string; isMetadataOnly?: boolean } | null> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    // Extract player response JSON
    const pm = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|let|const|window|\n)/s);
    if (!pm) return null;

    let pr: any;
    try {
      pr = JSON.parse(pm[1]);
    } catch {
      return null;
    }

    const title = pr?.videoDetails?.title || `YouTube ${videoId}`;
    const desc = pr?.videoDetails?.shortDescription || "";
    const author = pr?.videoDetails?.author || "";
    const keywords = pr?.videoDetails?.keywords || [];
    const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks || tracks.length === 0) {
      // No captions — return metadata only
      const content = [
        `Título: ${title}`,
        `Canal: ${author}`,
        keywords.length > 0 ? `Palavras-chave: ${keywords.slice(0, 20).join(", ")}` : "",
        desc ? `\n[Descrição]:\n${desc.slice(0, 5000)}` : "",
      ].filter(Boolean).join("\n");
      return content.length > 50 ? { title: `${title} [Sem Legendas]`, transcript: content, isMetadataOnly: true } : null;
    }

    // Prefer PT, then EN, then any
    const track =
      tracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
      tracks.find((t: any) => t.languageCode?.startsWith("en")) ||
      tracks[0];

    if (!track?.baseUrl) return null;

    const capRes = await fetch(track.baseUrl, { signal: AbortSignal.timeout(10000) });
    if (!capRes.ok) return null;
    const xml = await capRes.text();

    const segs: string[] = [];
    const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const d = decodeHtml(m[1].replace(/<[^>]+>/g, "")).trim();
      if (d) segs.push(d);
    }
    if (segs.length === 0) return null;

    const transcript = [
      `Título: ${title}`,
      `Canal: ${author}`,
      keywords.length > 0 ? `Palavras-chave: ${keywords.slice(0, 20).join(", ")}` : "",
      `\n[Transcrição]:\n${segs.join(" ").replace(/\s{2,}/g, " ").trim()}`,
    ].filter(Boolean).join("\n");

    return { title, transcript };
  } catch {
    return null;
  }
}

// ── Method 3: Jina.ai extraction as last resort for YouTube ─────────────────
async function fetchYouTubeViaJina(url: string, videoId: string): Promise<{ title: string; transcript: string } | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://r.jina.ai/${watchUrl}`, {
      headers: { Accept: "application/json", "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.data?.content?.trim();
    if (!content || content.length < 100) return null;
    return { title: data?.data?.title || `YouTube ${videoId}`, transcript: content.slice(0, 150000) };
  } catch {
    return null;
  }
}

// ── YouTube Orchestrator (3-layer fallback) ──────────────────────────────────
async function fetchYouTubeContent(url: string): Promise<{ title: string; transcript: string }> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("ID do vídeo não encontrado na URL");

  console.log(`[import-url-v2] Processing YouTube video: ${videoId}`);

  // Layer 1: youtubetranscript.com API (most resilient)
  const apiResult = await fetchTranscriptViaApi(videoId);
  if (apiResult && apiResult.transcript.length > 100) {
    console.log(`[import-url-v2] Layer 1 success: ${apiResult.transcript.length} chars`);
    return apiResult;
  }

  // Layer 2: Direct scraping
  const scrapingResult = await fetchTranscriptViaScraping(videoId);
  // If it's valid and has actual transcript (not just metadata), return it
  if (scrapingResult && !scrapingResult.isMetadataOnly && scrapingResult.transcript.length > 50) {
    console.log(`[import-url-v2] Layer 2 success: ${scrapingResult.transcript.length} chars`);
    return { title: scrapingResult.title, transcript: scrapingResult.transcript };
  }

  // Layer 3: Jina.ai (Fallback attempt if no transcript was found yet)
  const jinaResult = await fetchYouTubeViaJina(url, videoId);
  // Only accept Jina if it returns a meaningful amount of text
  // (otherwise it might just be the "Please enable JS" string)
  if (jinaResult && jinaResult.transcript.length > 400) {
    console.log(`[import-url-v2] Layer 3 success: ${jinaResult.transcript.length} chars`);
    return jinaResult;
  }

  // Layer 4: Fallback to Layer 2 metadata if we have nothing better
  if (scrapingResult && scrapingResult.isMetadataOnly) {
    console.log(`[import-url-v2] Fallback to layer 2 metadata (video has no captions): ${scrapingResult.transcript.length} chars`);
    return { title: scrapingResult.title, transcript: scrapingResult.transcript };
  }

  throw new Error("Não foi possível extrair conteúdo deste vídeo do YouTube. O vídeo pode não ter legendas disponíveis ou estar protegido.");
}

// ── Generic URL via Jina ─────────────────────────────────────────────────────
async function fetchGenericUrl(url: string): Promise<{ title: string; content: string }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "application/json", "X-Return-Format": "markdown" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Jina error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const content = data?.data?.content?.trim();
  if (!content || content.length < 50) throw new Error("Nenhum conteúdo extraído da URL");
  const title = data?.data?.title || new URL(url).hostname;
  return { title, content: content.slice(0, 200000) };
}

// ── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, brainId } = await req.json();
    if (!url || !brainId) throw new Error("URL e brainId são obrigatórios");

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const userId = await getUserIdFromJwt(authHeader);

    // @ts-expect-error: Deno is available at runtime
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify brain ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("id")
      .eq("id", brainId)
      .eq("user_id", userId)
      .single();
    if (brainErr || !brain) throw new Error("Brain não encontrado ou sem permissão");

    const parsed = new URL(url);
    const isYouTube = ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(parsed.hostname);

    if (isYouTube) {
      const { title, transcript } = await fetchYouTubeContent(url);
      const { error: insertErr } = await supabase.from("brain_texts").insert({
        brain_id: brainId,
        content: transcript,
        source_type: "youtube",
        file_name: title,
      });
      if (insertErr) throw new Error(`Erro ao salvar: ${insertErr.message}`);
      return new Response(
        JSON.stringify({ success: true, title, chars: transcript.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generic URL
    const { title, content } = await fetchGenericUrl(url);
    const { error: insertErr } = await supabase.from("brain_texts").insert({
      brain_id: brainId,
      content,
      source_type: "url_import",
      file_name: title,
    });
    if (insertErr) throw new Error(`Erro ao salvar: ${insertErr.message}`);
    return new Response(
      JSON.stringify({ success: true, title, chars: content.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[import-url-v2] Error:", err?.message);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
