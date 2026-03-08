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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { brainId, textId, processAll } = body;

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userId = getUserIdFromJwt(authHeader);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership - always check regardless of input shape
    const verifyBrainOwnership = async (brainIdToCheck: string) => {
      const { data: brain } = await supabase
        .from("brains")
        .select("user_id")
        .eq("id", brainIdToCheck)
        .single();
      if (!brain || brain.user_id !== userId) {
        return false;
      }
      return true;
    };

    if (textId) {
      // When textId is provided, look up its brain and verify ownership
      const { data: text } = await supabase
        .from("brain_texts")
        .select("brain_id")
        .eq("id", textId)
        .single();
      if (!text) {
        return new Response(JSON.stringify({ error: "Text not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!(await verifyBrainOwnership(text.brain_id))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (brainId) {
      if (!(await verifyBrainOwnership(brainId))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get texts to process
    let query = supabase.from("brain_texts").select("id, content, brain_id");
    if (textId) {
      query = query.eq("id", textId);
    } else if (brainId && processAll) {
      query = query.eq("brain_id", brainId).eq("rag_processed", false);
    } else {
      return new Response(JSON.stringify({ error: "Provide textId or brainId+processAll" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: texts, error: textsErr } = await query.limit(20);
    if (textsErr) throw textsErr;
    if (!texts || texts.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Nenhum texto para processar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const text of texts) {
      try {
        // Truncate content for analysis
        const contentForAnalysis = text.content.slice(0, 8000);

        const MODELS = [
          "google/gemini-2.5-flash-lite",
          "google/gemini-2.0-flash-001",
          "meta-llama/llama-3.3-70b-instruct:free",
          "arcee-ai/trinity-large-preview:free",
          "mistralai/mistral-small-3.1-24b-instruct:free",
        ];

        let rawContent = "";
        let aiSuccess = false;

        for (const model of MODELS) {
          try {
            console.log(`process-rag: trying model ${model} for text ${text.id}`);
            const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ai-second-brain.app",
                "X-Title": "AI Second Brain - RAG Processor",
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "system",
                    content: `Você é um sistema de análise de texto. Analise o texto fornecido e retorne um JSON com:
1. "summary": Um resumo conciso de 2-3 frases capturando os pontos principais do texto
2. "keywords": Uma lista de 5-15 palavras-chave relevantes que descrevem os temas, tópicos e conceitos do texto
3. "category": Uma categoria curta (ex: "tecnologia", "filosofia", "negócios", "pessoal", "saúde", "educação", etc)

Retorne APENAS o JSON válido, sem markdown, sem explicação. Exemplo:
{"summary": "...", "keywords": ["palavra1", "palavra2"], "category": "tecnologia"}`
                  },
                  {
                    role: "user",
                    content: contentForAnalysis,
                  },
                ],
                temperature: 0.3,
                max_tokens: 1000,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              rawContent = aiData.choices?.[0]?.message?.content || "";
              aiSuccess = true;
              console.log(`process-rag: success with model ${model}`);
              break;
            } else {
              const errText = await aiResponse.text();
              console.error(`process-rag: model ${model} failed (${aiResponse.status}):`, errText);
              if (aiResponse.status === 401) break;
              await new Promise(r => setTimeout(r, 1000));
            }
          } catch (fetchErr) {
            console.error(`process-rag: fetch error for model ${model}:`, fetchErr);
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (!aiSuccess) {
          console.error(`process-rag: all models failed for text ${text.id}`);
          continue;
        }
        
        // Parse JSON from response (handle potential markdown wrapping)
        let parsed;
        try {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch?.[0] || rawContent);
        } catch {
          console.error(`Failed to parse AI response for text ${text.id}:`, rawContent);
          continue;
        }

        // Update the text with RAG data
        const { error: updateErr } = await supabase
          .from("brain_texts")
          .update({
            rag_summary: parsed.summary || "",
            rag_keywords: parsed.keywords || [],
            category: parsed.category || null,
            rag_processed: true,
          })
          .eq("id", text.id);

        if (updateErr) {
          console.error(`Update error for text ${text.id}:`, updateErr);
        } else {
          processed++;
        }
      } catch (e) {
        console.error(`Error processing text ${text.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ processed, total: texts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-rag error:", e);
    return new Response(
      JSON.stringify({ error: "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
