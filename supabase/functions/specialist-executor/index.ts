// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Specialist Executor — Inspired by google-labs-code/jules-sdk
 * Executes specialized tasks for the AI Squad (Math, Automation, Design).
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const { brainId, skillType, payload } = await req.json();

    // Setup Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user ownership of the brain
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Sessão inválida");

    const { data: brain } = await supabase
      .from("brains")
      .select("id, execution_mode, specialist_role")
      .eq("id", brainId)
      .eq("user_id", user.id)
      .single();

    if (!brain) throw new Error("Acesso negado ao Especialista");
    if (brain.execution_mode === "none") throw new Error("Este Especialista não tem poder de execução habilitado");

    let result = null;

    // --- Execution Logic by Skill Type ---
    switch (skillType) {
      case "python_analysis":
        console.log(`[Specialist] Running Python analysis for ${brain.specialist_role}`);
        // In a real environment, this would call a Jules session or a sandbox.
        // For this prototype, we simulate a secure calculation.
        result = {
          output: "Cálculo financeiro processado com sucesso. VPL: R$ 1.250.000,00",
          logs: ["Executando numpy...", "Calculando fluxos de caixa...", "Aplicando TMA de 12%"],
          status: "success"
        };
        break;

      case "n8n_integration":
        console.log(`[Specialist] Triggering n8n workflow for ${brain.specialist_role}`);
        // Here we would call the n8n webhook provided in the brain config
        result = {
          message: "Fluxo de automação enviado ao n8n",
          trigger_id: crypto.randomUUID(),
          status: "dispatched"
        };
        break;

      default:
        throw new Error(`Tipo de habilidade desconhecido: ${skillType}`);
    }

    // Log the execution to the security audit trail
    await supabase.from("security_audit_logs").insert({
      event_type: "SPECIALIST_EXECUTION",
      table_name: "brains",
      record_id: brainId,
      user_id: user.id,
      new_data: { skillType, result }
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Specialist Executor Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
