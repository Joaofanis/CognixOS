import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["user", "assistant", "system"];
const MAX_MESSAGES = 100;
const MAX_CONTEXT_CHARS = 120_000;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

    const { targetBrainId, contextMessages, reason, userProfileSummary, mode } = body as {
      targetBrainId: unknown;
      contextMessages: unknown;
      reason: unknown;
      userProfileSummary: unknown;
      mode: "fast" | "thinking" | "default" | undefined;
    };

    if (!targetBrainId || typeof targetBrainId !== "string" || !UUID_REGEX.test(targetBrainId)) {
      return new Response(JSON.stringify({ error: "Invalid targetBrainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawMessages = Array.isArray(contextMessages) ? contextMessages : [];

    // Validate and sanitize messages
    const sanitizedMessages = [];
    for (let i = 0; i < Math.min(rawMessages.length, MAX_MESSAGES); i++) {
      const msg = rawMessages[i];
      if (!msg || typeof msg !== "object" || !VALID_ROLES.includes(msg.role) || typeof msg.content !== "string") {
        continue;
      }
      sanitizedMessages.push({ role: msg.role, content: msg.content.trim() });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT
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

    // Get brain and verify ownership
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
      return new Response(JSON.stringify({ error: "Forbidden" }), {
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
          contextParts.push(`${cat} ${keywords}\nResumo: ${t.rag_summary}`);
        } else {
          contextParts.push(t.content);
        }
      }
    }

    let contextTexts = contextParts.join("\n\n---\n\n");
    if (contextTexts.length > MAX_CONTEXT_CHARS) {
      contextTexts = contextTexts.slice(0, MAX_CONTEXT_CHARS) + "\n\n[...contexto truncado]";
    }

    const chatMode = mode === "thinking" ? "thinking" : mode === "fast" ? "fast" : "default";
    const chatTemperature = chatMode === "fast" ? 0.3 : chatMode === "thinking" ? 0.8 : 0.7;

    const reasonStr = typeof reason === "string" ? reason : "";
    const profileStr = typeof userProfileSummary === "string" ? userProfileSummary : "";

    // Build system prompt for summoned clone
    let systemPrompt = "";
    if (brain.system_prompt && brain.system_prompt.trim()) {
      systemPrompt = brain.system_prompt.trim();
    } else {
      const baseInstruction = "\n\nUse APENAS o contexto fornecido. Se a informação não estiver lá, admita que não sabe.";
      switch (brain.type) {
        case "person_clone":
          systemPrompt = `Você é a personificação digital de "${brain.name}". Emule perfeitamente o estilo de escrita, vocabulário e personalidade desta pessoa. ${baseInstruction}`;
          break;
        case "knowledge_base":
          systemPrompt = `Você é um Assistente especializado em "${brain.name}". ${baseInstruction}`;
          break;
        case "philosophy":
          systemPrompt = `Você é um mentor filosófico de "${brain.name}". ${baseInstruction}`;
          break;
        case "practical_guide":
          systemPrompt = `Você é um guia prático para "${brain.name}". ${baseInstruction}`;
          break;
        default:
          systemPrompt = `Você é ${brain.name}, um assistente de IA. ${baseInstruction}`;
      }
    }

    systemPrompt += `\n\nContexto de Conhecimento de "${brain.name}":\n${contextTexts}`;

    if (reasonStr) {
      systemPrompt += `\n\n## Contexto da Convocação\nVocê foi convocado para participar desta conversa pelo seguinte motivo: ${reasonStr}\nResponda de forma relevante ao contexto da conversa.`;
    }

    if (profileStr) {
      systemPrompt += `\n\nPerfil do usuário: ${profileStr}`;
    }

    const models = [
      "google/gemini-2.0-flash-001:free",
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ];

    let lastErrorInfo: { status?: number; text?: string } | null = null;
    let response = null;

    for (const model of models) {
      try {
        console.log(`summon-clone: trying model ${model}`);
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
          lastErrorInfo = { status: aiResponse.status, text: errorText };
          if (aiResponse.status === 401 || aiResponse.status === 400 || aiResponse.status === 403) break;
        }
      } catch (e) {
        lastErrorInfo = { text: e instanceof Error ? e.message : String(e) };
      }
    }

    if (!response) {
      return new Response(
        JSON.stringify({ error: "Falha ao processar resposta da IA." }),
        { status: lastErrorInfo?.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("summon-clone error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
