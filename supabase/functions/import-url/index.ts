import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // SSRF protection: block private/internal IP ranges
    const hostname = parsed.hostname;
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^\[?::1\]?$/,
      /^\[?fd/i,
      /^\[?fe80/i,
      /^metadata\.google\.internal$/i,
    ];
    if (blockedPatterns.some(p => p.test(hostname))) {
      throw new Error("URL não permitida: endereço interno ou reservado");
    }

    // Resolve DNS to check actual IP
    try {
      const ips = await Deno.resolveDns(hostname, "A");
      for (const ip of ips) {
        if (blockedPatterns.some(p => p.test(ip))) {
          throw new Error("URL não permitida: resolve para endereço interno");
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("não permitida")) throw e;
      // DNS resolution may fail for valid URLs in some environments, continue
    }

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Token inválido");

    // Verify brain belongs to user
    const { data: brain, error: brainErr } = await supabase
      .from("brains").select("id").eq("id", brainId).eq("user_id", user.id).single();
    if (brainErr || !brain) throw new Error("Brain não encontrado");

    // Fetch the URL
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SegundoCerebro/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    // Block redirects to prevent SSRF via redirect
    if (resp.status >= 300 && resp.status < 400) {
      throw new Error("Redirecionamentos não são permitidos por segurança");
    }
    if (!resp.ok) throw new Error(`Falha ao acessar URL: ${resp.status}`);
    
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("Apenas páginas HTML ou texto plano são suportadas");
    }

    const html = await resp.text();

    // Extract text from HTML — strip tags, collapse whitespace
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

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || parsed.hostname;

    // Save to brain_texts
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
