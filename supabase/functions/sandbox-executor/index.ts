import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const command = payload.command as string;
    
    // In a real V8/V9 production setup, this edge function just proxies the payload 
    // to an AWS Fargate container or a secure E2B Firecracker microVM endpoint.
    
    console.log(`[E2E Sandbox Dummy] Intercepting execution command:`, command);

    const restrictedTokens = ["rm -rf", "drop table", "delete from", "truncate"];
    const isDangerous = restrictedTokens.some(token => command.toLowerCase().includes(token));

    if (isDangerous) {
      // Return 403 to trigger a HITL interrupt upstairs
      return new Response(JSON.stringify({ 
        error: "FORBIDDEN_COMMAND", 
        message: "O comando disparou a cerca de segurança da Virtual Machine."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      output: `(Dummy Sandbox Exec: O comando '${command}' executou com sucesso numa MicroVM virtual).`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
