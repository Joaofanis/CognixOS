import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["user", "assistant", "system"];
const MAX_MESSAGES = 1000;
const MAX_MESSAGE_CONTENT_LENGTH = 4_000_000;
const MAX_BODY_SIZE = 20 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 800_000;

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

    const contentLength = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request body too large." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brainIds, messages, mode, activeBrainId } = body as {
      brainIds: unknown;
      messages: unknown;
      mode: "fast" | "thinking" | "default" | undefined;
      activeBrainId: unknown;
    };

    // Validate activeBrainId (the brain that should respond)
    const targetBrainId = activeBrainId || (Array.isArray(brainIds) && brainIds[0]);
    if (!targetBrainId || typeof targetBrainId !== "string" || !UUID_REGEX.test(targetBrainId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing activeBrainId." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid or missing messages." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Too many messages. Maximum is ${MAX_MESSAGES}.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object") {
        return new Response(JSON.stringify({ error: `Message at index ${i} is not valid.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!VALID_ROLES.includes(msg.role)) {
        return new Response(JSON.stringify({ error: `Message at index ${i} has invalid role.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
        return new Response(JSON.stringify({ error: `Message at index ${i} must have non-empty string content.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return new Response(JSON.stringify({ error: `Message at index ${i} exceeds maximum content length.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sanitizedMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content.trim(),
      }),
    );

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the active brain
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("name, type, description, user_id, system_prompt")
      .eq("id", targetBrainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (brain.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden: You don't own this brain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get brain texts for context
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content, rag_summary, rag_keywords, category, rag_processed")
      .eq("brain_id", targetBrainId)
      .order("created_at", { ascending: false })
      .limit(50);

    const contextParts: string[] = [];
    if (texts) {
      for (const t of texts) {
        if (t.rag_processed && t.rag_summary) {
          const keywords = t.rag_keywords ? `[Palavras-chave: ${(t.rag_keywords as string[]).join(", ")}]` : "";
          const cat = t.category ? `[Categoria: ${t.category}]` : "";
          contextParts.push(`${cat} ${keywords}\nResumo: ${t.rag_summary}\n\nConteúdo Original:\n${t.content}`);
        } else {
          contextParts.push(t.content);
        }
      }
    }

    let contextTexts = contextParts.join("\n\n---\n\n");
    if (contextTexts.length > MAX_CONTEXT_CHARS) {
      contextTexts = contextTexts.slice(0, MAX_CONTEXT_CHARS) + "\n\n[...contexto truncado]";
    }

    // Mode modifiers
    const chatMode = mode === "thinking" ? "thinking" : mode === "fast" ? "fast" : "default";
    const thinkingInstruction = chatMode === "thinking"
      ? `\n\n## Modo Pensamento Ativo\nAntes de responder, raciocine passo a passo entre as tags <raciocinio> e </raciocinio>. Após o raciocínio, forneça sua resposta final de forma clara. Formato obrigatório:\n<raciocinio>\n[seu raciocínio aqui]\n</raciocinio>\n\n[sua resposta final aqui]`
      : chatMode === "fast"
      ? `\n\n## Modo Rápido Ativo\nResponda de forma direta e concisa, sem elaborar desnecessariamente. Priorize clareza e velocidade.`
      : "";

    const chatTemperature = chatMode === "fast" ? 0.3 : chatMode === "thinking" ? 0.8 : 0.7;

    // Build system prompt
    let systemPrompt = "";
    if (brain.system_prompt && brain.system_prompt.trim()) {
      systemPrompt = brain.system_prompt.trim();
      systemPrompt += `\n\nContexto de Conhecimento de "${brain.name}":\n${contextTexts}`;
    } else {
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
        default:
          systemPrompt = `Você é ${brain.name}, um assistente de IA inteligente. ${baseInstruction}`;
      }
      systemPrompt += `\n\nContexto de Conhecimento de "${brain.name}":\n${contextTexts}`;
    }

    systemPrompt += thinkingInstruction;

    const models = [
      "google/gemini-2.0-flash-001:free",
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ];

    let lastErrorInfo = null;
    let response = null;

    for (const model of models) {
      try {
        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-second-brain.app",
            "X-Title": "AI Second Brain",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              ...sanitizedMessages,
            ],
            stream: true,
            temperature: chatTemperature,
            max_tokens: 16_000,
          }),
        });

        if (aiResponse.ok) {
          response = aiResponse;
          break;
        } else {
          const errorText = await aiResponse.text();
          lastErrorInfo = { status: aiResponse.status, text: errorText, model };
          if (aiResponse.status === 401 || aiResponse.status === 400 || aiResponse.status === 403) break;
        }
      } catch (e) {
        lastErrorInfo = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    if (!response) {
      return new Response(
        JSON.stringify({ error: "Falha ao processar resposta da IA. Tente novamente mais tarde." }),
        {
          status: lastErrorInfo?.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("general-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
