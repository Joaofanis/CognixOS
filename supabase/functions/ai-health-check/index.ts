// @ts-expect-error: Deno edge runtime — runs on Supabase, not Node
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const MODELS = [
  "google/gemini-2.5-flash-preview",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

const NOTIFY_EMAIL = "joaovitorfanis1@gmail.com";
const PROBE_PROMPT = "Respond with only the word OK.";

interface ModelResult {
  model: string;
  status: "ok" | "fail";
  error_msg?: string;
  latency_ms: number;
}

async function testModel(model: string, apiKey: string): Promise<ModelResult> {
  const start = Date.now();
  let status: "ok" | "fail" = "fail";
  let error_msg: string | undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-second-brain.app",
        "X-Title": "AI Second Brain",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROBE_PROMPT }],
        max_tokens: 5,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const reply: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
      if (reply.length > 0) {
        status = "ok";
      } else {
        error_msg = "Empty response from model";
      }
    } else {
      const body = await res.text().catch(() => "");
      error_msg = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    }
  } catch (err: unknown) {
    error_msg = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  return { model, status, error_msg, latency_ms: Date.now() - start };
}

async function sendEmailAlert(failed: ModelResult[]): Promise<void> {
  // Read SMTP config from Supabase Secrets
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10);
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn("SMTP credentials not configured — SMTP_HOST, SMTP_USER, SMTP_PASS needed.");
    return;
  }

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const failLines = failed
    .map((f) => `  • ${f.model}\n    Erro: ${f.error_msg ?? "desconhecido"} (${f.latency_ms}ms)`)
    .join("\n");

  const body = [
    `⚠️  AI Second Brain — Alerta de Saúde dos Modelos`,
    `Data: ${now}`,
    ``,
    `Os seguintes modelos FALHARAM no teste automático:`,
    ``,
    failLines,
    ``,
    `Acesse o painel do AI Second Brain para mais detalhes.`,
  ].join("\n");

  const client = new SmtpClient();
  try {
    await client.connectTLS({ hostname: smtpHost, port: smtpPort });
    await client.login({ username: smtpUser, password: smtpPass });
    await client.send({
      from: smtpUser,
      to: NOTIFY_EMAIL,
      subject: `[AI Second Brain] ⚠️ ${failed.length} modelo(s) com falha — ${now}`,
      content: body,
    });
    console.log("Alert email sent successfully via SMTP.");
  } catch (err: unknown) {
    console.error("SMTP send error:", err instanceof Error ? err.message : String(err));
  } finally {
    await client.close().catch(() => {});
  }
}

serve(async () => {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[ai-health-check] Checking ${MODELS.length} models…`);

  const results = await Promise.all(MODELS.map((m) => testModel(m, apiKey)));

  // Persist to Supabase
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error: dbErr } = await supabase.from("ai_health_logs").insert(
    results.map((r) => ({
      model: r.model,
      status: r.status,
      error_msg: r.error_msg ?? null,
      latency_ms: r.latency_ms,
    }))
  );
  if (dbErr) console.error("DB insert error:", dbErr.message);

  const failed = results.filter((r) => r.status === "fail");
  if (failed.length > 0) {
    await sendEmailAlert(failed);
  }

  const summary = {
    checked_at: new Date().toISOString(),
    total: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    failed: failed.length,
    results,
  };

  console.log("[ai-health-check] Done:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
