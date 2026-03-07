import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brainId, textId } = body as { brainId: unknown; textId: unknown };

    if (!brainId || typeof brainId !== "string" || !UUID_REGEX.test(brainId)) {
      return new Response(JSON.stringify({ error: "Invalid brainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify brain ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("user_id, type, name")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain || brain.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Brain not found or forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get texts to extract from
    let textsQuery = supabase
      .from("brain_texts")
      .select("id, content")
      .eq("brain_id", brainId);

    if (textId && typeof textId === "string" && UUID_REGEX.test(textId)) {
      textsQuery = textsQuery.eq("id", textId);
    } else {
      textsQuery = textsQuery.limit(15);
    }

    const { data: texts, error: textsErr } = await textsQuery;
    if (textsErr) throw textsErr;
    if (!texts || texts.length === 0) {
      return new Response(JSON.stringify({ extracted: 0, message: "Nenhum texto encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY2 = Deno.env.get("OPENROUTER_API_KEY");

    let totalExtracted = 0;

    for (const text of texts) {
      try {
        const contentSlice = text.content.slice(0, 6000);

        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY2}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-second-brain.app",
            "X-Title": "AI Second Brain - Quote Extractor",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.3-70b-instruct:free",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em análise linguística. Extraia do texto fornecido as frases, falas e expressões mais características e marcantes do autor — frases que revelam sua personalidade, forma de pensar, humor e estilo.

Retorne APENAS um JSON válido com esta estrutura:
{
  "quotes": [
    {"quote": "<frase exata ou levemente editada do texto>", "context": "<tema/contexto em 2-4 palavras>"},
    ...
  ]
}

Regras:
- Extraia até 6 frases por texto
- Prefira frases únicas, expressivas e que revelem a voz da pessoa
- Evite frases genéricas
- Mantenha o texto original, sem parafrasear
- context deve ser curto: "liderança", "filosofia", "humor", "criatividade", etc.`
              },
              {
                role: "user",
                content: contentSlice,
              },
            ],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`extract-quotes: AI error for text ${text.id}:`, await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";

        let parsed: { quotes?: Array<{ quote: string; context: string }> };
        try {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch?.[0] || rawContent);
        } catch {
          console.error(`extract-quotes: Failed to parse response for text ${text.id}`);
          continue;
        }

        if (!Array.isArray(parsed.quotes) || parsed.quotes.length === 0) continue;

        // Filter valid quotes
        const validQuotes = parsed.quotes
          .filter((q) => q.quote && q.quote.length > 10 && q.quote.length < 500)
          .slice(0, 6);

        if (validQuotes.length === 0) continue;

        // Insert quotes (avoiding duplicates by re-inserting)
        const quotesWithBrain = validQuotes.map((q) => ({
          brain_id: brainId,
          source_text_id: text.id,
          quote: q.quote,
          context: q.context || null,
        }));

        // Delete existing quotes for this text then re-insert
        await supabase
          .from("brain_quotes")
          .delete()
          .eq("source_text_id", text.id);

        const { error: insertErr } = await supabase
          .from("brain_quotes")
          .insert(quotesWithBrain);

        if (insertErr) {
          console.error(`extract-quotes: Insert error for text ${text.id}:`, insertErr);
        } else {
          totalExtracted += validQuotes.length;
        }
      } catch (e) {
        console.error(`extract-quotes: Error processing text ${text.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ extracted: totalExtracted, total: texts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-quotes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
