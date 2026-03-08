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

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com" ||
      u.hostname === "youtu.be" ||
      u.hostname === "www.youtube-nocookie.com"
    );
  } catch {
    return false;
  }
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    // /embed/ID or /v/ID
    const embedMatch = u.pathname.match(/^\/(embed|v)\/([^/?]+)/);
    if (embedMatch) return embedMatch[2];
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ");
}

async function fetchYouTubeTranscript(videoId: string): Promise<{ title: string; transcript: string }> {
  // Fetch YouTube page
  const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!pageResp.ok) throw new Error(`Falha ao acessar YouTube: ${pageResp.status}`);
  const html = await pageResp.text();

  // Extract ytInitialPlayerResponse
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!playerMatch) throw new Error("Não foi possível extrair dados do vídeo do YouTube");

  let playerResponse: any;
  try {
    playerResponse = JSON.parse(playerMatch[1]);
  } catch {
    throw new Error("Falha ao parsear dados do vídeo do YouTube");
  }

  // Get title and description
  const title = playerResponse?.videoDetails?.title || `YouTube ${videoId}`;
  const description = playerResponse?.videoDetails?.shortDescription || "";
  const author = playerResponse?.videoDetails?.author || "";
  const keywords = playerResponse?.videoDetails?.keywords || [];
  const lengthSeconds = playerResponse?.videoDetails?.lengthSeconds || "";

  // Get caption tracks
  const captionTracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
    // Build fallback content from all available metadata
    const parts: string[] = [];
    parts.push(`Título: ${title}`);
    if (author) parts.push(`Canal: ${author}`);
    if (lengthSeconds) parts.push(`Duração: ${Math.floor(Number(lengthSeconds) / 60)}min`);
    if (keywords.length > 0) parts.push(`Tags: ${keywords.slice(0, 20).join(", ")}`);
    if (description.trim().length > 0) parts.push(`\n[Descrição do Vídeo]:\n${description}`);

    const fallbackContent = parts.join("\n");
    if (fallbackContent.length < 20) {
      throw new Error("Este vídeo não possui legendas, descrição ou metadados suficientes para importação.");
    }
    return { title: `${title} [Sem Legendas]`, transcript: fallbackContent };
  }

  // Priority: pt → en → first available
  let selectedTrack =
    captionTracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
    captionTracks.find((t: any) => t.languageCode?.startsWith("en")) ||
    captionTracks[0];

  const captionUrl = selectedTrack?.baseUrl;
  if (!captionUrl) throw new Error("URL de legendas não encontrada");

  // Fetch caption XML
  const captionResp = await fetch(captionUrl, {
    signal: AbortSignal.timeout(10000),
  });
  if (!captionResp.ok) throw new Error("Falha ao baixar legendas");
  const captionXml = await captionResp.text();

  // Parse XML: extract text from <text> tags
  const textSegments: string[] = [];
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = textRegex.exec(captionXml)) !== null) {
    const decoded = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")).trim();
    if (decoded) textSegments.push(decoded);
  }

  if (textSegments.length === 0) throw new Error("Legendas vazias ou não puderam ser extraídas");

  const transcript = textSegments.join(" ").replace(/\s{2,}/g, " ").trim();
  const lang = selectedTrack?.languageCode || "unknown";

  return { title: `${title} [${lang}]`, transcript };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, brainId } = await req.json();
    if (!url || typeof url !== "string") throw new Error("URL inválida");
    if (!brainId || typeof brainId !== "string") throw new Error("brainId obrigatório");

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("URL mal formatada");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Protocolo inválido");

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Não autenticado");

    const userId = getUserIdFromJwt(authHeader);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify brain belongs to user
    const { data: brain, error: brainErr } = await supabase
      .from("brains").select("id").eq("id", brainId).eq("user_id", userId).single();
    if (brainErr || !brain) throw new Error("Brain não encontrado");

    // === YouTube handling ===
    if (isYouTubeUrl(url)) {
      const videoId = extractVideoId(url);
      if (!videoId) throw new Error("Não foi possível extrair o ID do vídeo do YouTube");

      const { title, transcript } = await fetchYouTubeTranscript(videoId);

      if (transcript.length < 10) throw new Error("Conteúdo extraído muito curto");
      if (transcript.length > 200000) throw new Error("Transcrição muito grande (max 200k chars)");

      const { error: insertErr } = await supabase.from("brain_texts").insert({
        brain_id: brainId,
        content: transcript,
        source_type: "youtube",
        file_name: title,
      });
      if (insertErr) throw new Error(`Falha ao salvar: ${insertErr.message}`);

      return new Response(JSON.stringify({ success: true, title, chars: transcript.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Generic URL handling (existing logic) ===
    // SSRF protection
    const hostname = parsed.hostname;
    const blockedPatterns = [
      /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./, /^169\.254\./, /^0\./, /^\[?::1\]?$/,
      /^\[?fd/i, /^\[?fe80/i, /^metadata\.google\.internal$/i,
    ];
    if (blockedPatterns.some(p => p.test(hostname))) {
      throw new Error("URL não permitida: endereço interno ou reservado");
    }

    try {
      const ips = await Deno.resolveDns(hostname, "A");
      for (const ip of ips) {
        if (blockedPatterns.some(p => p.test(ip))) {
          throw new Error("URL não permitida: resolve para endereço interno");
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("não permitida")) throw e;
    }

    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SegundoCerebro/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (resp.status >= 300 && resp.status < 400) {
      throw new Error("Redirecionamentos não são permitidos por segurança");
    }
    if (!resp.ok) throw new Error(`Falha ao acessar URL: ${resp.status}`);
    
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("Apenas páginas HTML ou texto plano são suportadas");
    }

    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s{3,}/g, "\n\n")
      .trim();

    if (text.length < 50) throw new Error("Página sem conteúdo suficiente");
    if (text.length > 200000) throw new Error("Página muito grande (max 200k chars)");

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || parsed.hostname;

    const { error: insertErr } = await supabase.from("brain_texts").insert({
      brain_id: brainId,
      content: text,
      source_type: "url_import",
      file_name: title,
    });
    if (insertErr) throw new Error(`Falha ao salvar: ${insertErr.message}`);

    return new Response(JSON.stringify({ success: true, title, chars: text.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
