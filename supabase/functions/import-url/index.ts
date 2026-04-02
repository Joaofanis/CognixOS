// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeHtml(t: string): string {
  return t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ");
}

async function getUserIdFromJwt(authHeader: string): Promise<string> {
  // @ts-expect-error: Deno is available at runtime
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-expect-error: Deno is available at runtime
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const c = createClient(url, key, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await c.auth.getUser();
  if (error || !user) throw new Error("Token inválido");
  return user.id;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const p = u.pathname.split("/");
    if (u.hostname === "youtu.be") return p[1] || null;
    if (["shorts", "live", "v", "embed"].includes(p[1])) return p[2] || null;
    return u.searchParams.get("v");
  } catch { return null; }
}

async function fetchYouTubeTranscript(videoId: string): Promise<{ title: string; transcript: string }> {
  const prResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!prResp.ok) throw new Error(`YouTube error: ${prResp.status}`);
  const html = await prResp.text();
  const pm = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!pm) throw new Error("Could not extract player response");
  const pr = JSON.parse(pm[1]);

  const title = pr?.videoDetails?.title || `YouTube ${videoId}`;
  const desc = pr?.videoDetails?.shortDescription || "";
  const author = pr?.videoDetails?.author || "";
  const kw = pr?.videoDetails?.keywords || [];
  const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks || tracks.length === 0) {
    return { title: `${title} [Sem Legendas]`, transcript: `Título: ${title}\nCanal: ${author}\n\n[Descrição]:\n${desc}` };
  }

  const track = tracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
    tracks.find((t: any) => t.languageCode?.startsWith("en")) || tracks[0];
  
  if (!track?.baseUrl) throw new Error("No caption URL");
  const cr = await fetch(track.baseUrl, { signal: AbortSignal.timeout(10000) });
  if (!cr.ok) throw new Error("Failed to download captions");
  const xml = await cr.text();
  const segs: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const d = decodeHtml(m[1].replace(/<[^>]+>/g, "")).trim();
    if (d) segs.push(d);
  }
  return { title, transcript: segs.join(" ").replace(/\s{2,}/g, " ").trim() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url, brainId } = await req.json();
    if (!url || !brainId) throw new Error("URL e brainId obrigatórios");
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const userId = await getUserIdFromJwt(authHeader);

    // @ts-expect-error: Deno is available at runtime
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify brain
    const { data: brain, error: brainErr } = await supabase
      .from("brains").select("id").eq("id", brainId).eq("user_id", userId).single();
    if (brainErr || !brain) throw new Error("Brain não encontrado");

    const parsed = new URL(url);
    if (["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(parsed.hostname)) {
      const videoId = extractVideoId(url);
      if (!videoId) throw new Error("ID do vídeo não encontrado");
      const { title, transcript } = await fetchYouTubeTranscript(videoId);
      await supabase.from("brain_texts").insert({ brain_id: brainId, content: transcript, source_type: "youtube", file_name: title });
      return new Response(JSON.stringify({ success: true, title, chars: transcript.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generic Jina import
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "application/json", "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`Jina error: ${resp.status}`);
    const res = await resp.json();
    const text = res.data?.content?.trim();
    if (!text) throw new Error("Nenhum conteúdo extraído");
    await supabase.from("brain_texts").insert({ brain_id: brainId, content: text.slice(0, 200000), source_type: "url_import", file_name: res.data.title || parsed.hostname });
    return new Response(JSON.stringify({ success: true, title: res.data.title, chars: text.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
