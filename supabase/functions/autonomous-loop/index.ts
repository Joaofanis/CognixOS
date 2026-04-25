import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentLoopPayload {
  brainId?: string;
  goal?: string;
  userId?: string;
  threadId?: string; // If provided, continues execution of the thread
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json() as AgentLoopPayload;

    // --- CASE A: SUBMIT (Create a new durable thread) ---
    if (!payload.threadId && payload.brainId && payload.goal && payload.userId) {
      const { data: thread, error: threadErr } = await supabaseClient
        .from("agent_threads")
        .insert({
          brain_id: payload.brainId,
          user_id: payload.userId,
          goal: payload.goal,
          status: 'pending',
          checkpoint_state: {
            messages: [{ role: 'system', content: `[SYSTEM] Iniciando missão: ${payload.goal}` }],
            turn: 0
          }
        })
        .select("id")
        .single();

      if (threadErr) throw threadErr;

      // In production, pg_cron would pick this up within 1 min.
      // We could trigger the first super-step asynchronously here:
      // EdgeRuntime.waitUntil(fetch(self...)) using the new Deno feature.
      
      return new Response(JSON.stringify({ 
        status: "Durable Thread Created", 
        threadId: thread.id,
        message: "O agente iniciará a execução em background." 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- CASE B: POLL / WORKER EXECUTION (Load checkpoint and run 1 step) ---
    // If no threadId is provided, we fetch the oldest pending/running thread (Cron mode)
    let threadQuery = supabaseClient
      .from("agent_threads")
      .select("*");
      
    if (payload.threadId) {
      threadQuery = threadQuery.eq("id", payload.threadId);
    } else {
      threadQuery = threadQuery.in("status", ["pending", "running"]).order("updated_at", { ascending: true }).limit(1);
    }

    const { data: threads, error: fetchErr } = await threadQuery;
    if (fetchErr) throw fetchErr;
    if (!threads || threads.length === 0) {
      return new Response(JSON.stringify({ status: "No active threads found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const thread = threads[0];
    
    // Mark as running
    await supabaseClient.from("agent_threads").update({ status: 'running', updated_at: new Date().toISOString() }).eq("id", thread.id);

    // Load Checkpoint State
    const state = thread.checkpoint_state;
    const currentTurn = state.turn || 0;

    console.log(`[Durable Execution] Retomando Thread ${thread.id} no Turno ${currentTurn+1}`);

    // ... Here goes the actual LLM call and Tool execution ...
    // Because this is a mock implementation for V7, we'll simulate a 5-turn completion or HITL suspend
    
    if (currentTurn >= 4) {
      // Finish
      await supabaseClient.from("agent_threads").update({ status: 'completed' }).eq("id", thread.id);
      return new Response(JSON.stringify({ status: "Completed", threadId: thread.id }), { headers: corsHeaders });
    }
    
    // Simulate HITL detection
    const isDangerousCommand = Math.random() > 0.8; // 20% chance to simulate a dangerous command
    if (isDangerousCommand) {
      console.log(`[Segurança] Comando destrutivo detectado. Suspendendo para HITL.`);
      await supabaseClient.from("agent_threads").update({ 
        status: 'suspended_hitl',
        checkpoint_state: { ...state, last_alert: 'Dangerous command rm -rf proposed.' }
      }).eq("id", thread.id);
      return new Response(JSON.stringify({ status: "Suspended (HITL)", threadId: thread.id }), { headers: corsHeaders });
    }

    // Checkpoint successful step
    state.turn = currentTurn + 1;
    state.messages.push({ role: 'assistant', content: `Executando passo avançado #${state.turn} de forma durável.` });
    
    await supabaseClient.from("agent_threads").update({ 
      checkpoint_state: state,
      updated_at: new Date().toISOString()
    }).eq("id", thread.id);

    return new Response(JSON.stringify({ 
      status: "Step Checkpointed", 
      threadId: thread.id, 
      turn: state.turn 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
