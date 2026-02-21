import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { brainId } = await req.json();
    if (!brainId || typeof brainId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid brainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify User JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("user_id")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (brain.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden: You don't own this brain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get brain texts
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content")
      .eq("brain_id", brainId);

    if (!texts || texts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum texto encontrado para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allText = texts.map((t) => t.content).join("\n\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen/qwen-2.5-72b-instruct:free",
        messages: [
          {
            role: "system",
            content: "Você é um analista de personalidade. Analise os textos e extraia dados estruturados.",
          },
          {
            role: "user",
            content: `Analise os seguintes textos de uma pessoa e extraia:\n1. Traços de personalidade (escala 0-10): extroversão, criatividade, pragmatismo, empatia, assertividade, curiosidade, disciplina, otimismo\n2. Temas mais frequentes (lista com nome e contagem estimada)\n\nTextos:\n${allText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_analysis",
              description: "Save personality analysis results",
              parameters: {
                type: "object",
                properties: {
                  personality_traits: {
                    type: "object",
                    properties: {
                      extroversão: { type: "number" },
                      criatividade: { type: "number" },
                      pragmatismo: { type: "number" },
                      empatia: { type: "number" },
                      assertividade: { type: "number" },
                      curiosidade: { type: "number" },
                      disciplina: { type: "number" },
                      otimismo: { type: "number" },
                    },
                    required: ["extroversão", "criatividade", "pragmatismo", "empatia", "assertividade", "curiosidade", "disciplina", "otimismo"],
                  },
                  frequent_themes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        count: { type: "number" },
                      },
                      required: ["name", "count"],
                    },
                  },
                },
                required: ["personality_traits", "frequent_themes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_analysis" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Modelo temporariamente limitado. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao analisar com IA");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou análise estruturada");

    const analysisData = JSON.parse(toolCall.function.arguments);

    // Upsert analysis
    const { error: upsertErr } = await supabase
      .from("brain_analysis")
      .upsert(
        {
          brain_id: brainId,
          personality_traits: analysisData.personality_traits,
          frequent_themes: analysisData.frequent_themes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "brain_id" }
      );

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-brain error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
