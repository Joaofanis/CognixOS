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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
      .order("created_at", { ascending: true });

    const contextTexts = texts?.map((t) => t.content).join("\n\n---\n\n") || "";

    // Build system prompt based on brain type
    let systemPrompt = "";
    switch (brain.type) {
      case "person_clone":
        systemPrompt = `Você é um clone de "${brain.name}". Responda EXATAMENTE como esta pessoa responderia, usando o estilo, tom, vocabulário e personalidade dela. Use APENAS os textos fornecidos como base para entender quem é essa pessoa. Nunca quebre o personagem. Se não souber algo com base nos textos, diga que não tem informação suficiente sobre isso.`;
        break;
      case "knowledge_base":
        systemPrompt = `Você é um assistente especializado em "${brain.name}". Use EXCLUSIVAMENTE os dados técnicos e informações fornecidos nos textos abaixo para responder. Não invente informações. Se algo não estiver nos textos, diga que não tem essa informação na base de conhecimento.`;
        break;
      case "philosophy":
        systemPrompt = `Você segue a filosofia/conceitos de "${brain.name}". Responda sempre alinhado com os conceitos e linha de pensamento descrita nos textos fornecidos. Aplique esses conceitos para responder perguntas e dar conselhos.`;
        break;
      case "practical_guide":
        systemPrompt = `Você é um guia prático sobre "${brain.name}". Use os dados e procedimentos fornecidos nos textos para orientar o usuário passo a passo. Seja prático, direto e baseie-se exclusivamente nos textos fornecidos.`;
        break;
    }

    systemPrompt += `\n\n--- TEXTOS DE REFERÊNCIA ---\n\n${contextTexts}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
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
