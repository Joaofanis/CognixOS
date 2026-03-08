import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TYPE_LABELS: Record<string, string> = {
  person_clone: "Clone de Pessoa",
  knowledge_base: "Base de Conhecimento",
  philosophy: "Filosofia / Conceitos",
  practical_guide: "Guia Prático",
};

// Validation constants
const VALID_BRAIN_TYPES = ["person_clone", "knowledge_base", "philosophy", "practical_guide"];
const MAX_NAME_LENGTH = 200;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use getUser() — the correct way to verify JWT in Supabase edge functions
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safe JSON parsing
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, type, tags } = body as { name: unknown; type: unknown; tags: unknown };

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "name is required and must be a non-empty string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return new Response(JSON.stringify({ error: `name must be at most ${MAX_NAME_LENGTH} characters` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate type if provided
    if (type !== undefined && type !== null) {
      if (typeof type !== "string" || !VALID_BRAIN_TYPES.includes(type)) {
        return new Response(JSON.stringify({ error: `Invalid type. Must be one of: ${VALID_BRAIN_TYPES.join(", ")}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate tags if provided
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        return new Response(JSON.stringify({ error: "tags must be an array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (tags.length > MAX_TAGS) {
        return new Response(JSON.stringify({ error: `Maximum ${MAX_TAGS} tags allowed` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const tag of tags) {
        if (typeof tag !== "string" || tag.length > MAX_TAG_LENGTH) {
          return new Response(JSON.stringify({ error: `Each tag must be a string with at most ${MAX_TAG_LENGTH} characters` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const sanitizedName = name.trim();
    const sanitizedType = (typeof type === "string" && VALID_BRAIN_TYPES.includes(type)) ? type : "person_clone";
    const sanitizedTags = Array.isArray(tags) ? (tags as string[]).map(t => t.trim()).filter(t => t.length > 0) : [];

    const typeLabel = TYPE_LABELS[sanitizedType] || sanitizedType;
    const tagStr = sanitizedTags.length ? `Tags: ${sanitizedTags.join(", ")}.` : "";

    const prompt = `Você é um especialista em IA. Gere uma descrição em português para um cérebro de IA chamado "${sanitizedName}" do tipo "${typeLabel}". ${tagStr}\nRetorne APENAS 2-3 frases descrevendo o que este cérebro faz, seu propósito e como ele pode ajudar o usuário. Seja direto, específico e empolgante. Sem aspas, sem prefixos como 'Descrição:'.`;

    // 5-model waterfall — same pattern as generate-prompt
    const models = [
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.3-70b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
    ];

    let description = "";

    for (const model of models) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-second-brain.app",
            "X-Title": "AI Second Brain",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 200,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          console.error(`Model ${model} failed: ${response.status} - ${errBody}`);
          continue;
        }

        const result = await response.json();
        const raw = result.choices?.[0]?.message?.content?.trim() || "";
        if (raw.length > 10) {
          description = raw;
          console.log(`generate-description: success with ${model}`);
          break;
        }
        console.warn(`Model ${model} returned empty content`);
      } catch (e) {
        console.error(`generate-description: error with ${model}:`, e);
      }
    }

    if (!description) {
      return new Response(JSON.stringify({ error: "Todos os modelos falharam ao gerar a descrição. Tente novamente em instantes." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
