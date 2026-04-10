// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ITERATIONS = 5;
const CONTEXT_LIMIT_CHARS = 4000;

// Model Router definitions - Empowered by User's selections
const MODELS = {
  architect: "google/gemini-2.5-flash-lite", // Reliable JSON planner
  complex: "meta-llama/llama-3.3-70b-instruct:free", // Heavy Programming/Logic
  reasoning: "qwen/qwen3.6-plus:free", // Complex Reasoning / Multilingual
  creative: "minimax/minimax-m2.5:free", // RP, Creative, Long Generation
  fast: "sourceful/riverflow-v2-fast", // Very fast routing/simple replies
  summarizing: "stepfun/step-3.5-flash:fre", // Quick Summarization
  rag: "arcee-ai/trinity-large-preview:free", // Deep Reading & Retrieval
  thinking: "liquid/lfm-2.5-1.2b-thinking:free", // Chain-of-thought analysis
  instruction: "google/gemma-3-4b-it:free", // Direct simple instruction following
};

function getModelForCategory(category: string): string {
  if (category === "complex") return MODELS.complex;
  if (category === "reasoning") return MODELS.reasoning;
  if (category === "creative") return MODELS.creative;
  if (category === "fast") return MODELS.fast;
  if (category === "summarizing") return MODELS.summarizing;
  if (category === "rag") return MODELS.rag;
  if (category === "thinking") return MODELS.thinking;
  if (category === "instruction") return MODELS.instruction;
  return MODELS.fast; // fallback
}

function isPromptInjection(query: string): boolean {
  const lowQuery = query.toLowerCase();
  const injectionPatterns = [
    "ignore all previous instructions", "ignore everything before", "jailbreak", "dan prompt", "reveal the pre-prompt"
  ];
  return injectionPatterns.some(pattern => lowQuery.includes(pattern));
}

// Intercept <tool> tags in agent responses
function extractTools(response: string) {
  const tools = [];
  const regex = /<tool\s+action="([^"]+)"(?:\s+query="([^"]+)")?\s*\/>/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    tools.push({ action: match[1], query: match[2], raw: match[0] });
  }
  return tools;
}

async function callAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  systemPrompt: string,
  model: string,
  stream = false
): Promise<string | ReadableStream> {
  let fallbackModel = model;
  
  const attempt = async (targetModel: string) => {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-second-brain.app",
        "X-Title": "AI Second Brain",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream,
        temperature: 0.6,
        max_tokens: 32_000,
      }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    if (stream) return resp.body!;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  };

  try {
    return await attempt(model);
  } catch (error) {
    console.error(`Model ${model} failed, trying fallback`);
    return await attempt(MODELS.fast);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const body = await req.json();
    const { query } = body as { query: string };
    if (!query) throw new Error("Missing query");

    if (isPromptInjection(query)) {
      return new Response(
        JSON.stringify({ error: "Security Lock: Prompt Injection Detected." }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subagents } = await supabase.from("subagents").select("id, name, role, system_prompt, preferred_model").eq("user_id", userId);
    const { data: skills } = await supabase.from("agent_skills").select("id, name, description, trigger_word, content").eq("user_id", userId);

    if (!subagents || subagents.length === 0) throw new Error("No subagents found.");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // --- STEP 1: Admin Routing & Multi-Provider ---
          send({ type: "admin_thinking", message: "Arquiteto mapeando complexidade matemática, criativa e alocando provedores..." });

          const adminSystemPrompt = `Sua tarefa é analisar a requisição e montar o esquadrão ideal de IAs.
Subagentes: ${JSON.stringify(subagents.map(a => ({id: a.id, role: a.role})))}
Skills: ${JSON.stringify(skills?.map(s => ({id:s.id, desc:s.description})) || [])}

Retorne JSON EXATO:
{
  "selected_skill_id": "id ou null",
  "selected_agent_ids": ["id1", "id2"],
  "task_category": "complex|reasoning|creative|fast|rag|thinking|instruction",
  "reasoning": "Sua lógica"
}
Categories:
- complex: Lógica brutal, código pesado.
- reasoning: Análise complexa e multilíngue.
- creative: RP, longa geração criativa.
- fast: Respostas diretas e velozes.
- rag: Leitura profunda de grandes textos fornecidos.
- thinking: Cadeia de pensamento, deduções matemáticas/filosóficas.
- instruction: Seguir instrução ao pé da letra de forma simples.`;
          
          let planData = { selected_agent_ids: subagents.slice(0, 2).map(a => a.id), selected_skill_id: null, task_category: "fast", reasoning: "Fallback" };
          try {
            const adminResp = await callAI([{ role: "user", content: query }], OPENROUTER_API_KEY, adminSystemPrompt, MODELS.architect) as string;
            const match = adminResp.match(/\{[\s\S]*\}/);
            if (match) planData = JSON.parse(match[0]);
          } catch(e) { console.warn("Admin parsing failed", e); }

          const activeSquad = subagents.filter(a => planData.selected_agent_ids?.includes(a.id));
          const routedModel = getModelForCategory(planData.task_category);

          send({
            type: "squad_formed",
            squad: activeSquad.map(a => ({ id: a.id, name: a.name, type: a.role })),
            reasoning: `${planData.reasoning} | Categoria: ${planData.task_category.toUpperCase()} | Modelo: ${routedModel}`,
            strategy: "OpenClaude Dynamic + Agent Tools",
            routed_model: routedModel
          });

          const squadHistory: { agentName: string; agentId: string; content: string }[] = [];
          let conversationContext = `Tarefa Principal: ${query}`;
          if (planData.selected_skill_id) {
             const sk = skills?.find(s => s.id === planData.selected_skill_id);
             if (sk) conversationContext += `\nPlaybook Ativado: ${sk.content}`;
          }

          let iteration = 0;
          // --- STEP 2: Execution with Token Economy & Tools ---
          while (iteration < MAX_ITERATIONS) {
            iteration++;
            send({ type: "iteration_start", iteration, maxIterations: MAX_ITERATIONS });

            // TOKEN ECONOMY
            const currentHistoryString = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n\n");
            if (currentHistoryString.length > CONTEXT_LIMIT_CHARS && iteration > 1) {
               send({ type: "context_compression", message: "Arquiteto comprimindo contexto histórico global..." });
               const summaryPrompt = "Resuma o progresso atual preservando apenas dados técnicos concluídos e a meta restante.";
               const summary = await callAI([{ role: "user", content: `Tarefa: ${query}\nHistórico:\n${currentHistoryString}\n---\nResumo Estruturado:`}], OPENROUTER_API_KEY, summaryPrompt, MODELS.summarizing) as string;
               squadHistory.length = 0;
               squadHistory.push({ agentName: "Arquiteto (Estado Comprimido)", agentId: "admin", content: summary });
            }

            for (const agent of activeSquad) {
              const fullPrompt = `${agent.system_prompt}\nSiga sua função estritamente.
Você tem acesso a Ferramentas Autônomas REAIS. Para invocar uma, você DEVE retornar a tag e NADA MAIS (o sistema vai interceptar e devolver a resposta):
1. <tool action="web_search" query="TERMO PARA BUSCA" /> (Usa JinaAI para busca leve e livre de ad-block na WEB)
2. <tool action="read_url" query="https://site.com" /> (Raspa um site transformando em puro texto/markdown limpo)
3. <tool action="search_memory" query="PALAVRA_CHAVE" /> (Pesquisa o banco de dados mental via text-search no projeto)

Se você não sabe a resposta, USE as ferramentas! Por exemplo, se perguntarem os preços do bitcoin agora, devolva:
<tool action="web_search" query="bitcoin price live" />

Aguarde o retorno da ferramenta antes de formular a resposta para o usuário. Se a memória não voltar ou já souber responder, responda diretamente.`;
              
              const historyText = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n\n");
              send({ type: "agent_thinking", agentId: agent.id, agentName: agent.name, iteration });

              let agentModel = agent.preferred_model && agent.preferred_model.includes("/") ? agent.preferred_model : routedModel;

              let agentResp = await callAI([
                { role: "user", content: `${conversationContext}\n\nTrabalho da equipe acumulado:\n${historyText || "Base de trabalho limpa."}\n\nSua vez:` }
              ], OPENROUTER_API_KEY, fullPrompt, agentModel) as string;

              // Tool Execution
              const tools = extractTools(agentResp);
              if (tools && tools.length > 0) {
                 for (const t of tools) {
                   send({ type: "tool_execution", agentName: agent.name, tool: t.action, query: t.query });
                   
                   let toolResult = "";
                   try {
                     if (t.query && t.query.length > 500) {
                        throw new Error("Security Block: A query excedeu o escopo permitido.");
                     }
                     
                     if (t.action === "read_url") {
                         try {
                           const parsedUrl = new URL(t.query || "");
                           if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                              throw new Error("Protocolo isolado (apenas HTTP/HTTPS permitido).");
                           }
                           const forbidden = ["localhost", "127.0.0.1", "169.254.169.254", "0.0.0.0"];
                           if (forbidden.includes(parsedUrl.hostname)) {
                              throw new Error("SSRF Protection Blocked Access");
                           }
                         } catch(e) { throw new Error("Assinatura de URL Inválida."); }
                     }

                     if (t.action === "web_search" || t.action === "read_url") {
                       const baseEndpoint = t.action === "web_search" ? "https://s.jina.ai/" : "https://r.jina.ai/";
                       const fetchUrl = baseEndpoint + encodeURIComponent(t.query || "");
                       const jinaResp = await fetch(fetchUrl, { headers: { "Accept": "text/plain", "X-Retain-Images": "none" }});
                       if (!jinaResp.ok) throw new Error("Jina AI Error");
                       const rawText = await jinaResp.text();
                       toolResult = rawText.slice(0, 3500); // 3500 limit chars
                     } else if (t.action === "search_memory") {
                       const { data, error } = await supabase.rpc("text_search_brain", { p_query: t.query, p_user_id: userId });
                       if (error) throw error;
                       if (data && data.length > 0) {
                         toolResult = data.map((d: any) => `Memória:\n${d.content}`).join("\n\n").slice(0, 3500);
                       } else {
                         toolResult = "Nenhuma memória encontrada sobre isso.";
                       }
                     } else {
                       toolResult = "Comando de ferramenta inválido.";
                     }
                   } catch(err: any) {
                     toolResult = `Falha na Ferramenta: ${err.message}`;
                   }
                   
                   agentResp += `\n\n[SISTEMA TÉCNICO - RETORNO DA FERRAMENTA QUE VOCÊ INVOCOU]:\n${toolResult}\n[FIM DO RETORNO]\nLeia isso e continue ou finalize sua resposta.`;
                 }
              }

              squadHistory.push({ agentName: agent.name, agentId: agent.id, content: agentResp });
              send({ type: "agent_response", agentId: agent.id, agentName: agent.name, agentType: agent.role, content: agentResp, iteration });
            }

            const gateSystemPrompt = `Quality Gate. Avalie se a resposta supre: "${query}". Responda JSON: { "satisfied": true/false, "reason": "motivo", "improvements_needed": "faltou algo" }`;
            const fullWork = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n");
            
            let evalData = { satisfied: true, reason: "Aprovado" };
            try {
              const evalResp = await callAI([{ role: "user", content: fullWork }], OPENROUTER_API_KEY, gateSystemPrompt, MODELS.architect) as string;
              const jsonMatch = evalResp.match(/\{[\s\S]*\}/);
              if (jsonMatch) evalData = JSON.parse(jsonMatch[0]);
            } catch (e) {}

            send({ type: "admin_evaluation", iteration, ...evalData });
            if (evalData.satisfied) break;
            conversationContext += `\nGate Reject: Focar na correção: ${evalData.improvements_needed}`;
          }

          // --- STEP 3: Synthesis ---
          send({ type: "synthesizing", message: "Arquiteto elaborando entrega final unificada..." });
          const synthPrompt = `Você é o Sintetizador. Apresente a resolução da equipe para o usuário. Use Markdown lindamente. Não mostre os bastidores ou as ferramentas.`;
          const workFinal = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n\n");
          const finalStream = await callAI([{ role: "user", content: `Tarefa: ${query}\nMaterial Interno:\n${workFinal}` }], OPENROUTER_API_KEY, synthPrompt, routedModel, true) as ReadableStream;

          send({ type: "synthesis_start" });
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
                if (content) { fullSynthesis += content; send({ type: "synthesis_token", content }); }
              } catch {}
            }
          }
          send({ type: "done", finalAnswer: fullSynthesis });

        } catch (err: any) {
          send({ type: "error", message: err.message || "Erro desconhecido" });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
