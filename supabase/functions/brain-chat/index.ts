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
    const { brainId, messages } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get brain info
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("name, type, description")
      .eq("id", brainId)
      .single();
    if (brainErr) throw brainErr;

    // Get brain texts for context
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content")
      .eq("brain_id", brainId)
      .order("created_at", { ascending: false }) // Newer first
      .limit(50); // Simple limit for now

    const contextTexts = texts?.map((t) => t.content).join("\n\n---\n\n") || "";

    // Build system prompt based on brain type
    let systemPrompt = "";
    const baseInstruction = "\n\nUse APENAS o contexto fornecido abaixo. Se a informação não estiver lá, admita honestamente que não sabe. Mantenha as respostas concisas e úteis.";

    switch (brain.type) {
      case "person_clone":
        systemPrompt = `Você é a personificação digital de "${brain.name}". Seu objetivo é emular perfeitamente o estilo de escrita, vocabulário, gírias, tom emocional e personalidade desta pessoa. ${baseInstruction}`;
        break;
      case "knowledge_base":
        systemPrompt = `Você é um Assistente especializado em "${brain.name}". Atue como um especialista técnico altamente preciso. ${baseInstruction}`;
        break;
      case "philosophy":
        systemPrompt = `Você é um mentor que segue estritamente a linha de raciocínio de "${brain.name}". Suas respostas devem ser reflexivas e baseadas nos princípios filosóficos encontrados no contexto. ${baseInstruction}`;
        break;
      case "practical_guide":
        systemPrompt = `Você é um guia instrucional prático para "${brain.name}". Responda com passos claros, listas e orientações diretas para execução. ${baseInstruction}`;
        break;
    }

    systemPrompt += `\n\nContexto de Conhecimento de "${brain.name}":\n${contextTexts}`;

    const models = [
      "qwen/qwen-2.5-72b-instruct:free",
      "google/gemma-2-9b-it:free",
      "mistralai/mistral-7b-instruct:free",
      "nvidia/nemotron-4-340b-instruct:free",
      "liquid/lfm-2.5-1.2b-thinking:free",
      "stepfun/step-3.5-flash:free",
      "arcee-ai/trinity-large-preview:free"
    ];

    let lastError = null;
    let response = null;

    for (const model of models) {
      try {
        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-second-brain.lovable.app",
            "X-Title": "AI Second Brain",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            stream: true,
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        if (aiResponse.ok) {
          response = aiResponse;
          break;
        } else {
          lastError = { status: aiResponse.status, text: await aiResponse.text(), model };
          if (aiResponse.status !== 429 && aiResponse.status !== 503) break; // Don't retry for non-transient errors
          console.warn(`Model ${model} failed with ${aiResponse.status}. Trying next...`);
        }
      } catch (e) {
        lastError = e;
        console.error(`Fetch error for model ${model}:`, e);
      }
    }

    if (!response) {
      if (lastError?.status === 429) {
        return new Response(JSON.stringify({ error: "Todos os modelos gratuitos estão congestionados. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao conectar com provedores de IA. Tente mudar o modelo ou aguarde." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("brain-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
