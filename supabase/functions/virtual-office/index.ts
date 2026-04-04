import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_AGENTS = 10;
const MAX_ITERATIONS = 5;
const ARCHITECT_MODEL = "google/gemini-2.0-flash-001";
const AGENT_MODEL = "google/gemini-1.5-flash";

async function callAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  systemPrompt: string,
  model: string,
  json = false
): Promise<string> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Virtual Office AIOS",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      response_format: json ? { type: "json_object" } : undefined,
    }),
  });

  if (!resp.ok) throw new Error(`AI request failed: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { challenge, name } = await req.json();
    if (!challenge) throw new Error("Missing challenge");

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Admin client (Service Role) to manage subagents and squads
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Auth User
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // --- PHASE 1: Initialize Squad (CEO) ---
          send({ type: "planning", message: "CEO analisando o desafio e estruturando o organigrama..." });
          
          const { data: squad, error: squadErr } = await supabase
            .from("squads")
            .insert({ user_id: user.id, name: name || "Virtual Office", challenge, status: "planning" })
            .select()
            .single();
          if (squadErr) throw squadErr;

          const ceoPrompt = `Você é o CEO (Arquiteto) do Escritório Virtual. Sua missão é analisar um DESAFIO e definir os 2-3 primeiros SUBAGENTES GESTORES necessários.
IMPORTANTE: Cada gestor deve ser um "Clone Digital" de uma referência mundial real daquela área (ex: Alex Hormozi para Vendas, Steve Jobs para Design, Michael Porter para Estratégia, etc).

Challenge: ${challenge}

Responda em JSON:
{
  "managers": [
    { 
      "name": "Nome", 
      "role": "Cargo", 
      "cloned_from": "Nome da Referência Real (ex: Seth Godin)",
      "justification": "Por que esta pessoa é a melhor para este desafio?"
    }
  ],
  "initial_vision": "Sua visão estratégica inicial"
}`;

          const planningResp = await callAI([{ role: "user", content: challenge }], OPENROUTER_API_KEY, ceoPrompt, ARCHITECT_MODEL, true);
          const plan = JSON.parse(planningResp);
          
          send({ type: "plan_ready", vision: plan.initial_vision, squadId: squad.id });

          // --- PHASE 2: Hiring & Virtual Cloning ---
          send({ type: "hiring", message: "Clonagem Sintética de Gestores em andamento..." });
          const managerIds: string[] = [];
          
          for (const m of plan.managers) {
            // Virtual Cloning Synthesis
            send({ type: "cloning", message: `Forjando DNA Sugestivo de ${m.cloned_from} para ${m.name}...` });
            
            const cloningPrompt = `Você é um ENGENHEIRO DE PROMPTS DE ELITE. Sua tarefa é criar o "Sistema Operacional Cognitivo" (DNA) para um Agente Autônomo que clonará a expertise de: [${m.cloned_from}].
            
            O DNA deve conter:
            1. 🧠 IDENTIDADE: Como essa pessoa pensa?
            2. 🧬 PERFIL DISC/ENEAGRAMA: Comportamento sob pressão.
            3. ⚙️ FRAMEWORKS: Quais metodologias/modelos mentais ela usa?
            4. 🗣️ DIGI-VOICE: Tom, vocabulário e padrão de sintaxe.
            
            Crie um System Prompt EXTREMAMENTE poderoso e denso em Português para este agente atuar como [${m.role}] no desafio [${challenge}].`;
            
            const dna = await callAI([{ role: "user", content: "Gere o DNA operacional." }], OPENROUTER_API_KEY, cloningPrompt, ARCHITECT_MODEL);

            const { data: manager, error: mErr } = await supabase
              .from("subagents")
              .insert({
                user_id: user.id,
                squad_id: squad.id,
                name: m.name,
                role: m.role,
                cloned_from: m.cloned_from,
                system_prompt: dna,
                preferred_model: AGENT_MODEL,
                is_autonomous: true
              })
              .select("id")
              .single();
            
            if (!mErr && manager) managerIds.push(manager.id);
            send({ type: "hired", agent: m.name, role: m.role, clonedFrom: m.cloned_from });
          }

          // --- PHASE 3: Task Delegation ---
          send({ type: "executing", message: "Iniciando ciclo de iterações e delegando tarefas..." });
          let iteration = 0;
          let finalSynthesis = "";

          while (iteration < MAX_ITERATIONS) {
            iteration++;
            send({ type: "iteration", iteration });

            for (const mId of managerIds) {
              const { data: agent } = await supabase.from("subagents").select("*").eq("id", mId).single();
              send({ type: "agent_working", agentName: agent.name });

              // Manage current sub-reports
              const { data: reports } = await supabase
                .from("squad_messages")
                .select("*")
                .eq("squad_id", squad.id)
                .eq("receiver_id", mId);
              
              const history = reports?.map(r => r.content).join("\n") || "Início da tarefa.";
              const taskPrompt = `${agent.system_prompt}\n\nTarefa: Resolva sua parte deste desafio: ${challenge}\n\nHistórico de Subordinados:\n${history}`;
              
              const output = await callAI([{ role: "user", content: "Prossiga com sua análise e entregue seu relatório parcial." }], OPENROUTER_API_KEY, taskPrompt, AGENT_MODEL);
              
              await supabase.from("subagents").update({ task_output: output }).eq("id", mId);
              send({ type: "agent_report", agentName: agent.name, content: output });
              
              // Internal Report to CEO (Architect)
              await supabase.from("squad_messages").insert({
                squad_id: squad.id,
                sender_id: mId,
                content: output,
                type: "report"
              });
            }

            // Quality Check / Break Condition
            const gatePrompt = `Você é o CEO. Avalie os relatórios parciais e decida se a missão está completa.
Challenge: ${challenge}
Relatórios: [Relatórios dos Gestores aqui...]

Responda em JSON: { "satisfied": true/false, "feedback": "o que falta" }`;
            // Simplified break
            if (iteration >= 2) break;
          }

          // --- PHASE 4: Final Synthesis ---
          send({ type: "synthesizing", message: "Compilando entrega final do escritório..." });
          const { data: allReports } = await supabase.from("squad_messages").select("content").eq("squad_id", squad.id).eq("type", "report");
          const material = allReports?.map(r => r.content).join("\n\n---\n\n");
          
          const synthPrompt = `Você é o CEO. Use estes relatórios para criar o DOCUMENTO FINAL DEFINITIVO para o usuário. Formate em Markdown premium.`;
          finalSynthesis = await callAI([{ role: "user", content: `Material:\n${material}` }], OPENROUTER_API_KEY, synthPrompt, ARCHITECT_MODEL);
          
          await supabase.from("squads").update({ final_report: finalSynthesis, status: "completed" }).eq("id", squad.id);
          send({ type: "done", finalReport: finalSynthesis });

        } catch (err: any) {
          send({ type: "error", message: err.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
