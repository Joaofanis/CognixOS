import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ITERATIONS = 5;
const MAX_CONTEXT_CHARS = 120_000;

const MODELS = [
  "google/gemini-2.5-flash-preview-09-2025",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

async function callAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  systemPrompt: string,
  stream = false
): Promise<string | ReadableStream> {
  for (const model of MODELS) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai-second-brain.app",
          "X-Title": "AI Second Brain",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream,
          temperature: 0.7,
          max_tokens: 32_000,
        }),
      });

      if (!resp.ok) continue;

      if (stream) return resp.body!;

      const data = await resp.json();
      return data.choices?.[0]?.message?.content || "";
    } catch {
      continue;
    }
  }
  throw new Error("All AI models failed");
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
    const { query, brainIds } = body as {
      query: string;
      brainIds: string[];
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Load all available brains for this user
    const brainsQuery = supabase
      .from("brains")
      .select("id, name, type, description, system_prompt, user_id")
      .eq("user_id", userId);

    if (brainIds && Array.isArray(brainIds) && brainIds.length > 0) {
      brainsQuery.in("id", brainIds);
    }

    const { data: allBrains, error: brainsErr } = await brainsQuery;
    if (brainsErr || !allBrains || allBrains.length === 0) {
      return new Response(JSON.stringify({ error: "No brains found for squad" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load context for each brain
    const brainContexts: Record<string, string> = {};
    for (const brain of allBrains) {
      const { data: texts } = await supabase
        .from("brain_texts")
        .select("content, rag_summary, rag_keywords, category, rag_processed")
        .eq("brain_id", brain.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const parts: string[] = [];
      if (texts) {
        for (const t of texts) {
          if (t.rag_processed && t.rag_summary) {
            parts.push(`Resumo: ${t.rag_summary}\nConteúdo: ${t.content}`);
          } else {
            parts.push(t.content);
          }
        }
      }
      let ctx = parts.join("\n\n---\n\n");
      if (ctx.length > MAX_CONTEXT_CHARS / allBrains.length) {
        ctx = ctx.slice(0, MAX_CONTEXT_CHARS / allBrains.length) + "\n[...truncado]";
      }
      brainContexts[brain.id] = ctx;
    }

    // Use a streaming response (SSE) to stream the squad process
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          const line = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(line));
        };

        try {
          // Step 1: Admin agent decides which squad members to use
          const adminSystemPrompt = `Você é o Agente Administrador de um squad de IA especializado. 
Você gerencia um conjunto de clones de IA e deve selecionar os mais relevantes para responder a uma query.

Clones disponíveis:
${allBrains.map(b => `- ID: ${b.id} | Nome: ${b.name} | Tipo: ${b.type} | Descrição: ${b.description || "N/A"}`).join("\n")}

Responda SOMENTE com um JSON válido com este formato:
{
  "selected_ids": ["id1", "id2", ...],
  "reasoning": "Explicação de por que esses clones foram escolhidos",
  "strategy": "Como eles devem colaborar"
}
Selecione de 2 a ${Math.min(4, allBrains.length)} clones.`;

          send({ type: "admin_thinking", message: "Agente Administrador analisando a query..." });

          const adminResponse = await callAI(
            [{ role: "user", content: `Query: ${query}` }],
            OPENROUTER_API_KEY,
            adminSystemPrompt
          ) as string;

          let squadPlan: { selected_ids: string[]; reasoning: string; strategy: string };
          try {
            const jsonMatch = adminResponse.match(/\{[\s\S]*\}/);
            squadPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : { selected_ids: allBrains.slice(0, 2).map(b => b.id), reasoning: "Default selection", strategy: "Sequential" };
          } catch {
            squadPlan = { selected_ids: allBrains.slice(0, 2).map(b => b.id), reasoning: "Default selection", strategy: "Sequential" };
          }

          // Ensure valid selections
          squadPlan.selected_ids = squadPlan.selected_ids.filter(id =>
            allBrains.some(b => b.id === id)
          );
          if (squadPlan.selected_ids.length === 0) {
            squadPlan.selected_ids = allBrains.slice(0, 2).map(b => b.id);
          }

          const squadBrains = allBrains.filter(b => squadPlan.selected_ids.includes(b.id));

          send({
            type: "squad_formed",
            squad: squadBrains.map(b => ({ id: b.id, name: b.name, type: b.type })),
            reasoning: squadPlan.reasoning,
            strategy: squadPlan.strategy,
          });

          // Step 2 – Iterative discussion between squad members
          const squadHistory: { agentName: string; agentId: string; content: string }[] = [];
          let iteration = 0;
          let conversationContext = `Query original: ${query}\n\nEstratégia de colaboração: ${squadPlan.strategy}`;

          while (iteration < MAX_ITERATIONS) {
            iteration++;
            send({ type: "iteration_start", iteration, maxIterations: MAX_ITERATIONS });

            for (const brain of squadBrains) {
              const brainSystemPrompt = brain.system_prompt?.trim() ||
                (() => {
                  switch (brain.type) {
                    case "person_clone": return `Você é a personificação digital de "${brain.name}". Emule perfeitamente seu estilo, vocabulário e personalidade.`;
                    case "knowledge_base": return `Você é um especialista técnico em "${brain.name}". Responda com precisão técnica.`;
                    case "philosophy": return `Você é um mentor filosófico que segue o pensamento de "${brain.name}". Seja reflexivo.`;
                    case "practical_guide": return `Você é um guia prático para "${brain.name}". Foque em passos acionáveis.`;
                    default: return `Você é ${brain.name}, um assistente de IA especializado.`;
                  }
                })();

              const fullBrainPrompt = `${brainSystemPrompt}\n\nContexto de Conhecimento:\n${brainContexts[brain.id]}\n\n---\nVocê está participando de um squad colaborativo. Contribua com sua perspectiva única baseada no seu conhecimento. Se outros membros já responderam, leve em conta suas contribuições.`;

              const historyMessages = squadHistory.map(h => ({
                role: "user" as const,
                content: `[${h.agentName}]: ${h.content}`,
              }));

              const agentMessages = [
                ...historyMessages,
                { role: "user" as const, content: `Contexto: ${conversationContext}\n\nQuery: ${query}\n\nContribua com sua resposta baseada no seu conhecimento específico. Seja conciso e direto.` },
              ];

              send({ type: "agent_thinking", agentId: brain.id, agentName: brain.name, iteration });

              const agentResponse = await callAI(agentMessages, OPENROUTER_API_KEY, fullBrainPrompt) as string;

              squadHistory.push({ agentName: brain.name, agentId: brain.id, content: agentResponse });

              send({
                type: "agent_response",
                agentId: brain.id,
                agentName: brain.name,
                agentType: brain.type,
                content: agentResponse,
                iteration,
              });
            }

            // Admin evaluates if we have a good enough answer
            const evalSystemPrompt = `Você é o Agente Administrador. Avalie se as respostas do squad são suficientes e completas para responder a query original.

Responda SOMENTE com JSON:
{
  "satisfied": true/false,
  "reason": "explicação",
  "improvements_needed": "o que ainda precisa ser melhorado (se não satisfeito)"
}`;

            const evalHistory = squadHistory.map(h =>
              `[${h.agentName}]: ${h.content}`
            ).join("\n\n");

            const evalResponse = await callAI(
              [{ role: "user", content: `Query: ${query}\n\nRespostas do Squad:\n${evalHistory}` }],
              OPENROUTER_API_KEY,
              evalSystemPrompt
            ) as string;

            let evaluation: { satisfied: boolean; reason: string; improvements_needed?: string };
            try {
              const jsonMatch = evalResponse.match(/\{[\s\S]*\}/);
              evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : { satisfied: false, reason: "Parse error" };
            } catch {
              evaluation = { satisfied: false, reason: "Parse error" };
            }

            send({ type: "admin_evaluation", iteration, ...evaluation });

            if (evaluation.satisfied || iteration >= MAX_ITERATIONS) break;

            conversationContext += `\n\nIteração ${iteration} - Melhorias necessárias: ${evaluation.improvements_needed || "Refine respostas"}`;
          }

          // Step 3 – Admin synthesizes final answer
          send({ type: "synthesizing", message: "Agente Administrador sintetizando resposta final..." });

          const synth = squadHistory.map(h => `**${h.agentName}:**\n${h.content}`).join("\n\n---\n\n");

          const synthSystemPrompt = `Você é o Agente Administrador. Sintetize as contribuições de todos os membros do squad em uma resposta final coerente, precisa e completa. 

Não mencione os membros do squad explicitamente. Apenas forneça a melhor resposta possível para a query original, integrando os insights de todos.

Escreva em português brasileiro. Seja claro, preciso e bem estruturado.`;

          const finalStream = await callAI(
            [{ role: "user", content: `Query: ${query}\n\nContribuições do Squad:\n${synth}` }],
            OPENROUTER_API_KEY,
            synthSystemPrompt,
            true // stream
          ) as ReadableStream;

          // Stream the final synthesis
          send({ type: "synthesis_start" });

          // We need to gather the stream and re-emit it as tokens
          const reader = finalStream.getReader();
          const decoder = new TextDecoder();
          let textBuffer = "";
          let fullSynthesis = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            textBuffer += decoder.decode(value, { stream: true });
            const lines = textBuffer.split("\n");
            textBuffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) continue;
              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullSynthesis += content;
                  send({ type: "synthesis_token", content });
                }
              } catch {/* ignore */}
            }
          }

          send({ type: "done", finalAnswer: fullSynthesis });

        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "Erro desconhecido" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("agent-squad error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
