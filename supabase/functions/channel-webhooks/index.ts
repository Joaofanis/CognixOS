import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // This function handles incoming webhook requests from external channels
    // like WhatsApp (Meta Graph API), Slack Events API, or MS Teams.
    
    // We instantiate a service role client to operate securely
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    const url = new URL(req.url);
    const channel = url.searchParams.get("channel") || "unknown";

    console.log(`[Webhook] Recebido de canal: ${channel}`, JSON.stringify(payload).slice(0, 200));

    // Here we would route based on the `channel`. 
    // Example for WhatsApp:
    if (channel === "whatsapp") {
      // 1. Validation for Meta verification
      if (req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        
        if (mode === "subscribe" && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      }

      // 2. Process incoming messages
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];

      if (message) {
        const fromNumber = message.from;
        const textObject = message.text;
        
        if (textObject?.body) {
          console.log(`Mensagem recebida do WhatsApp (${fromNumber}): ${textObject.body}`);
          
          // Next steps:
          // A) Fetch the user ID linked to this phone number from public.profiles
          // B) Inject the message into public.messages
          // C) Trigger `brain-chat` or an asynchronous response loop to reply back via Meta API
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook accepted" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(`[Webhook Erro]:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
