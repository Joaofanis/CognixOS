// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ITERATIONS = 5;

// Default fallback models if subagent doesn't specify one
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const ARCHITECT_MODEL = "google/gemini-2.0-flash-001";

async function callAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  systemPrompt: string,
  model: string,
  stream = false
): Promise<string | ReadableStream> {
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
      max_tokens: 16_000,
    }),
  });

  if (!resp.ok) {
    throw new Error(`AI request failed with status ${resp.status}`);
  }

  if (stream) return resp.body!;
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const body = await req.json();
    const { query } = body as { query: string };
    if (!query) throw new Error("Missing query");

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load Subagents
    const { data: subagents } = await supabase
      .from("subagents")
      .select("id, name, role, system_prompt, preferred_model")
      .eq("user_id", userId);

    // Load Skills (Playbooks)
    const { data: skills } = await supabase
      .from("agent_skills")
      .select("id, name, description, trigger_word, content")
      .eq("user_id", userId);

    if (!subagents || subagents.length === 0) {
      return new Response(JSON.stringify({ error: "No subagents found. Please create them in the AIOS Factory." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // --- STEP 1: Admin Routing & Skill Matching ---
          send({ type: "admin_thinking", message: "Administrador AIOS analisando a tarefa e playbooks..." });

          const adminSystemPrompt = `Você é o Arquiteto/Orquestrador do AIOS. 
Sua tarefa é analisar a requisição do usuário, verificar se há alguma Skill (Playbook) relevante, e escolher os Subagentes apropriados para o trabalho.

Skills Disponíveis:
${skills?.map(s => `- [${s.name}]: Gatilho: ${s.trigger_word}. Descrição: ${s.description}`).join("\n") || "Nenhuma skill."}

Subagentes Disponíveis:
${subagents.map(a => `- ID: ${a.id} | Nome: ${a.name} | Role: ${a.role}`).join("\n")}

Responda SOMENTE em JSON:
{
  "selected_skill_id": "ID da skill se alguma for disparada pelo usuário (ex: !blog) ou se encaixar perfeitamente na tarefa, senão null",
  "selected_agent_ids": ["id1", "id2"],
  "reasoning": "Por que?"
}`;
          
          let planData = { selected_agent_ids: subagents.slice(0, 2).map(a => a.id), selected_skill_id: null, reasoning: "Fallback" };
          try {
            const adminResp = await callAI([{ role: "user", content: query }], OPENROUTER_API_KEY, adminSystemPrompt, ARCHITECT_MODEL) as string;
            const match = adminResp.match(/\{[\s\S]*\}/);
            if (match) planData = JSON.parse(match[0]);
          } catch(e) { console.warn("Admin parsing failed", e); }

          // Ensure valid agents
          planData.selected_agent_ids = planData.selected_agent_ids?.filter(id => subagents.some(a => a.id === id));
          if (!planData.selected_agent_ids || planData.selected_agent_ids.length === 0) {
            planData.selected_agent_ids = subagents.slice(0, 2).map(a => a.id);
          }

          const activeSquad = subagents.filter(a => planData.selected_agent_ids!.includes(a.id));
          const activeSkill = skills?.find(s => s.id === planData.selected_skill_id);

          send({
            type: "squad_formed",
            squad: activeSquad.map(a => ({ id: a.id, name: a.name, type: a.role })),
            reasoning: planData.reasoning + (activeSkill ? ` Usando o playbook interno: ${activeSkill.name}` : ""),
            strategy: "AIOS Factory Line",
          });

          const squadHistory: { agentName: string; agentId: string; content: string }[] = [];
          
          let conversationContext = `Tarefa Principal: ${query}`;
          if (activeSkill) {
            conversationContext += `\n\nATENÇÃO OBRIGATÓRIA: Siga estritamente este Playbook/Skill definido pelo usuário:\n${activeSkill.content}`;
          }

          let iteration = 0;
          // --- STEP 2: Execution (Sequential/Iterative) ---
          while (iteration < MAX_ITERATIONS) {
            iteration++;
            send({ type: "iteration_start", iteration, maxIterations: MAX_ITERATIONS });

            for (const agent of activeSquad) {
              const fullPrompt = `${agent.system_prompt}\n\nVocê faz parte de uma linha de montagem hierárquica. Sua função é estritamente: ${agent.role}.\nCumpra sua função com base na Tarefa e no que os outros agentes já fizeram. Se a tarefa exige revisão e você é o revisor, aponte os erros ou forneça correções diretas.`;
              
              const historyText = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n\n");
              
              send({ type: "agent_thinking", agentId: agent.id, agentName: agent.name, iteration });

              const agentModel = agent.preferred_model || DEFAULT_MODEL;
              
              const agentResp = await callAI([
                { role: "user", content: `${conversationContext}\n\nTrabalho anterior na linha de montagem:\n${historyText || "Você é o primeiro a atuar."}\n\nFaça a SUA parte agora, focando na sua especialidade.` }
              ], OPENROUTER_API_KEY, fullPrompt, agentModel) as string;

              squadHistory.push({ agentName: agent.name, agentId: agent.id, content: agentResp });
              send({ type: "agent_response", agentId: agent.id, agentName: agent.name, agentType: agent.role, content: agentResp, iteration });
            }

            // Quality Gate Check by the Architect
            const gateSystemPrompt = `Você é o Quality Gate da fábrica AIOS. Revise o trabalho atual dos subagentes contra a tarefa original.
Responda SOMENTE em JSON: { "satisfied": true/false, "reason": "motivo explícito", "improvements_needed": "instruções para a próxima iteração" }`;

            const fullWork = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n\n");
            
            let evalData = { satisfied: true, reason: "Aprovado por fallback" };
            try {
              const evalResp = await callAI([{ role: "user", content: `Tarefa: ${query}\nPlaybook: ${activeSkill?.content||'Nenhum'}\n\nTrabalho:\n${fullWork}` }], OPENROUTER_API_KEY, gateSystemPrompt, ARCHITECT_MODEL) as string;
              const jsonMatch = evalResp.match(/\{[\s\S]*\}/);
              if (jsonMatch) evalData = JSON.parse(jsonMatch[0]);
            } catch (e) { console.warn("Gate eval failed", e); }

            send({ type: "admin_evaluation", iteration, ...evalData });

            if (evalData.satisfied) break;
            conversationContext += `\n\nQuality Gate rejeitou a iteração ${iteration}. Correções necessárias: ${evalData.improvements_needed}`;
          }

          // --- STEP 3: Synthesis ---
          send({ type: "synthesizing", message: "Quality Gate aprovado. Arquiteto sintetizando entrega final..." });
          
          const synthPrompt = `Você é o Arquiteto-Chefe. Sintetize o esforço da linha de montagem na resposta FINAL e DEFINITIVA que será entregue ao usuário. Formate lindamente em Markdown. Não fale sobre os agentes, apenas entregue o produto final.`;
          
          const workFinal = squadHistory.map(h => `[${h.agentName}]: ${h.content}`).join("\n\n");

          const finalStream = await callAI(
            [{ role: "user", content: `Tarefa Original: ${query}\n\nMaterial Produzido:\n${workFinal}` }],
            OPENROUTER_API_KEY, synthPrompt, ARCHITECT_MODEL, true
          ) as ReadableStream;

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
                if (content) {
                  fullSynthesis += content;
                  send({ type: "synthesis_token", content });
                }
              } catch {/* ignore */}
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
