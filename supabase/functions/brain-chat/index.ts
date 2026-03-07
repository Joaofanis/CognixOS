import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validation constants
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["user", "assistant", "system"];
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CONTENT_LENGTH = 50000; // 50k chars per message
const MAX_BODY_SIZE = 3 * 1024 * 1024; // 3MB total body size (3x increase)

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Safe JSON parsing with body size check
    const contentLength = parseInt(
      req.headers.get("Content-Length") || "0",
      10,
    );
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({
          error: "Request body too large. Maximum size is 1MB.",
        }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { brainId, messages } = body as {
      brainId: unknown;
      messages: unknown;
    };

    // --- Input Validation ---

    // Validate brainId: must be a non-empty string in UUID format
    if (!brainId || typeof brainId !== "string" || !UUID_REGEX.test(brainId)) {
      return new Response(
        JSON.stringify({
          error: "Invalid or missing brainId. Must be a valid UUID.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate messages: must be a non-empty array within size limits
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid or missing messages. Must be a non-empty array.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({
          error: `Too many messages. Maximum is ${MAX_MESSAGES}.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate each message structure
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object") {
        return new Response(
          JSON.stringify({
            error: `Message at index ${i} is not a valid object.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (!VALID_ROLES.includes(msg.role)) {
        return new Response(
          JSON.stringify({
            error: `Message at index ${i} has invalid role "${msg.role}". Must be one of: ${VALID_ROLES.join(", ")}.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: `Message at index ${i} must have non-empty string content.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return new Response(
          JSON.stringify({
            error: `Message at index ${i} exceeds maximum content length of ${MAX_MESSAGE_CONTENT_LENGTH} characters.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Sanitize messages to only pass through allowed fields
    const sanitizedMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content.trim(),
      }),
    );

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY)
      throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify User JWT using getClaims
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } =
      await userClient.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get brain info and verify ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("name, type, description, user_id, system_prompt")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain) {
      return new Response(JSON.stringify({ error: "Brain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (brain.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You don't own this brain" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get brain texts for context — prefer RAG-processed summaries
    const { data: texts } = await supabase
      .from("brain_texts")
      .select("content, rag_summary, rag_keywords, category, rag_processed")
      .eq("brain_id", brainId)
      .order("created_at", { ascending: false })
      .limit(50);

    const MAX_CONTEXT_CHARS = 30000;
    
    // Build optimized context: use RAG summaries + keywords for processed texts, full content for unprocessed
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
      contextTexts =
        contextTexts.slice(0, MAX_CONTEXT_CHARS) +
        "\n\n[...contexto truncado por limite]";
      console.log(`brain-chat: truncated context to ${MAX_CONTEXT_CHARS} chars`);
    }

    // Build system prompt - use custom prompt if available, otherwise default
    let systemPrompt = "";

    if (brain.system_prompt && brain.system_prompt.trim()) {
      // User has a custom system prompt — use it and append context
      systemPrompt = brain.system_prompt.trim();
      systemPrompt += `\n\nContexto de Conhecimento de "${brain.name}":\n${contextTexts}`;
    } else {
      // Default prompts by brain type
      const baseInstruction =
        "\n\nUse APENAS o contexto fornecido abaixo. Se a informação não estiver lá, admita honestamente que não sabe. Mantenha as respostas concisas e úteis.";

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
    }

    const models = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "arcee-ai/trinity-large-preview:free",
      "stepfun/step-3.5-flash:free",
      "z-ai/glm-4.5-air:free",
    ];

    let lastErrorInfo = null;
    let response = null;

    for (const model of models) {
      try {
        console.log(`Attempting with model: ${model}`);
        const aiResponse = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
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
              temperature: 0.7,
              max_tokens: 30000, // 3x increase from 10000
            }),
          },
        );

        if (aiResponse.ok) {
          response = aiResponse;
          break;
        } else {
          const errorText = await aiResponse.text();
          lastErrorInfo = { status: aiResponse.status, text: errorText, model };
          console.error(
            `Model ${model} failed with ${aiResponse.status}:`,
            errorText,
          );

          // If it's a "fatal" error (auth, billing, etc.), don't bother with other models
          if (
            aiResponse.status === 401 ||
            aiResponse.status === 400 ||
            aiResponse.status === 403
          ) {
            break;
          }
        }
      } catch (e) {
        lastErrorInfo = { error: e instanceof Error ? e.message : String(e) };
        console.error(`Fetch error for model ${model}:`, e);
      }
    }

    if (!response) {
      const errorMsg = lastErrorInfo?.text
        ? `Provedor de IA retornou erro ${lastErrorInfo.status}: ${lastErrorInfo.text}`
        : "Falha ao conectar com todos os provedores de IA.";

      return new Response(
        JSON.stringify({
          error: "Falha ao processar resposta da IA. Tente novamente mais tarde.",
        }),
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
    console.error("brain-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
