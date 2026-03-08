import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getUserIdFromJwt(authHeader: string): string {
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (!payload.sub) throw new Error("Token sem identificação");
  return payload.sub;
}

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

    const userId = getUserIdFromJwt(authHeader);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recentMessages } = body as { recentMessages: unknown };
    if (!Array.isArray(recentMessages)) {
      return new Response(JSON.stringify({ error: "Invalid recentMessages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple profile update: increment message count
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const userMessages = recentMessages.filter((m: any) => m.role === "user");
    const totalLength = userMessages.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
    const avgLength = userMessages.length > 0 ? Math.round(totalLength / userMessages.length) : 0;

    await supabase
      .from("user_ai_profiles")
      .upsert({
        user_id: userId,
        message_count: userMessages.length,
        avg_message_length: avgLength,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-user-profile error:", e);
    return new Response(
      JSON.stringify({ error: "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
