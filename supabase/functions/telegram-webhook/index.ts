// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno modules are valid in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const update: any = await req.json();

    if (!update || !update.message || !update.message.text) {
      return new Response("Not a text message", { status: 200, headers: corsHeaders });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text: string = message.text;

    // Helper to send message back to telegram user
    const sendTelegramMessage = async (text: string) => {
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" }),
      });
    };

    // 1. Linking command (/start <uuid>)
    if (text.startsWith("/start ")) {
      const token = text.split(" ")[1];
      if (token) {
        // Find profile with this token
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_link_token", token)
          .single();

        if (profile) {
          // Link success
          await supabase
            .from("profiles")
            .update({ telegram_chat_id: chatId, telegram_link_token: null })
            .eq("id", profile.id);

          await sendTelegramMessage("🤖 *Ponte neural estabelecida!*\n\nSua conta do CognixOS foi vinculada com sucesso. Você já pode conversar com seus Clones primários diretamente daqui.");
          return new Response("Linked", { status: 200, headers: corsHeaders });
        } else {
          await sendTelegramMessage("Token inválido ou expirado. Tente gerar um novo link na plataforma.");
          return new Response("Invalid token", { status: 200, headers: corsHeaders });
        }
      }
    }

    // 2. Chatting Mode
    // Look up the user by telegram_chat_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .single();

    if (!profile) {
      await sendTelegramMessage("Nenhuma conta do CognixOS vinculada. Acesse o portal, conecte sua conta do Telegram e tente novamente.");
      return new Response("User not linked", { status: 200, headers: corsHeaders });
    }

    // Find user's pinned/active clone
    const { data: brains } = await supabase
      .from("brains")
      .select("id, name, system_prompt")
      .eq("user_id", profile.id)
      .eq("is_pinned", true)
      .limit(1);

    if (!brains || brains.length === 0) {
      await sendTelegramMessage("Você ainda não tem um 'Cérebro Pinned' ativo. Acesse o CognixOS e marque um Clone como prioritário na sua mesa.");
      return new Response("No brain", { status: 200, headers: corsHeaders });
    }

    const brain = brains[0];
    await sendTelegramMessage(`_Processando no córtex do clone: ${brain.name}..._`);

    // Very basic call to OpenRouter or fallback for now.
    // In production, we would invoke `brain-chat` function or duplicate the logic here.
    // For now, let's call OpenRouter.
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
       await sendTelegramMessage("Erro: API Key do sistema indisponível.");
       return new Response("No key", { status: 200 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Auto or standard small model for telegram test
        messages: [
          { role: "system", content: brain.system_prompt || "Você é um assistente." },
          { role: "user", content: text }
        ]
      })
    });

    const aiData = await response.json();
    const reply = aiData.choices?.[0]?.message?.content || "Anomalia neural: sem resposta.";

    await sendTelegramMessage(reply);

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(msg, { status: 500, headers: corsHeaders });
  }
});
