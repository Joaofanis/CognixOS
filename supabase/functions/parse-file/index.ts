// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getUserIdFromJwtAndVerify(authHeader: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Token inválido ou expirado");
  return user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await getUserIdFromJwtAndVerify(authHeader);

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const brainId = formData.get("brainId") as string | null;

    if (!file || !brainId) {
      return new Response(JSON.stringify({ error: "Missing file or brainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify brain ownership
    const { data: brain, error: brainErr } = await supabase
      .from("brains")
      .select("user_id")
      .eq("id", brainId)
      .single();

    if (brainErr || !brain || brain.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Brain not found or forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = file.name.toLowerCase();
    let content = "";

    if (fileName.endsWith(".txt")) {
      content = await file.text();
    } else if (fileName.endsWith(".pdf")) {
      // Use pdf-parse for PDF extraction
      try {
        const pdfParse = (await import("https://esm.sh/pdf-parse@1.1.1")).default;
        const buffer = await file.arrayBuffer();
        const data = await pdfParse(new Uint8Array(buffer));
        content = data.text || "";
      } catch (e) {
        console.error("PDF parse error:", e);
        return new Response(JSON.stringify({ error: "Erro ao processar PDF. Tente um arquivo menor ou outro formato." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (fileName.endsWith(".docx")) {
      // Use mammoth for DOCX extraction
      try {
        const mammoth = await import("https://esm.sh/mammoth@1.6.0");
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        content = result.value || "";
      } catch (e) {
        console.error("DOCX parse error:", e);
        return new Response(JSON.stringify({ error: "Erro ao processar DOCX. Tente outro formato." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Formato não suportado. Use .txt, .pdf ou .docx" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!content.trim()) {
      return new Response(JSON.stringify({ error: "Nenhum texto extraído do arquivo" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to brain_texts
    const { error: insertErr } = await supabase
      .from("brain_texts")
      .insert({
        brain_id: brainId,
        content: content.trim(),
        source_type: "file_upload",
        file_name: file.name,
      });

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, chars: content.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-file error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
