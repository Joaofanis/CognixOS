/**
 * Batch Auto-Clone Script — Creates 18 elite clones via the 7-agent pipeline.
 * Usage: node scripts/batch-clone.mjs
 */

const SUPABASE_URL = "https://pnmxqvaafdecqmeradfc.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubXhxdmFhZmRlY3FtZXJhZGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzMzMTMsImV4cCI6MjA4NjkwOTMxM30.MhgGsNHefvsR3h4J9TZXajgQsz2D9oHQD69YVyRjtiE";
const AUTO_CLONE_URL = `${SUPABASE_URL}/functions/v1/auto-clone`;

// ── Elite Roster ───────────────────────────────────────────────────────────
const EXPERTS = [
  // Vendas
  { name: "Jordan Belfort", area: "Vendas" },
  { name: "Zig Ziglar", area: "Vendas" },
  { name: "Grant Cardone", area: "Vendas" },
  // Marketing
  { name: "Seth Godin", area: "Marketing" },
  { name: "Gary Vaynerchuk", area: "Marketing" },
  { name: "Philip Kotler", area: "Marketing" },
  // Análise Financeira
  { name: "Aswath Damodaran", area: "Análise Financeira" },
  { name: "Ray Dalio", area: "Análise Financeira" },
  { name: "Howard Marks", area: "Análise Financeira" },
  // Investimentos
  { name: "Warren Buffett", area: "Investimentos" },
  { name: "Peter Lynch", area: "Investimentos" },
  { name: "Nassim Nicholas Taleb", area: "Investimentos" },
  // Administração
  { name: "Peter Drucker", area: "Administração" },
  { name: "Jim Collins", area: "Administração" },
  { name: "Jack Welch", area: "Administração" },
  // Estruturação de Negócios (Eric Ries already done)
  { name: "Alex Hormozi", area: "Estruturação" },
  { name: "Michael Porter", area: "Estruturação" },
];

// ── Auth ───────────────────────────────────────────────────────────────────
async function signIn() {
  const email = process.env.SUPA_EMAIL;
  const password = process.env.SUPA_PASSWORD;
  if (!email || !password) {
    console.error("❌ Set SUPA_EMAIL and SUPA_PASSWORD environment variables.");
    process.exit(1);
  }

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("❌ Login failed:", err);
    process.exit(1);
  }

  const data = await resp.json();
  console.log("✅ Logged in as:", data.user?.email);
  return data.access_token;
}

// ── Clone one expert ──────────────────────────────────────────────────────
async function cloneExpert(token, expert, index, total) {
  const tag = `[${index + 1}/${total}]`;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${tag} 🧬 Starting clone: ${expert.name} (${expert.area})`);
  console.log(`${"═".repeat(60)}`);

  try {
    const resp = await fetch(AUTO_CLONE_URL, {
      method: "POST",
      signal: AbortSignal.timeout(600_000), // 10 minute timeout per clone
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: expert.name }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`${tag} ❌ HTTP ${resp.status}: ${errText}`);
      return { expert: expert.name, status: "FAILED", error: errText };
    }

    // Read SSE stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastStep = "";
    let brainId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          lastStep = data.step || lastStep;
          
          if (data.agent) {
            console.log(`  ${tag} 🤖 Agent: ${data.agent} → ${data.message || data.step}`);
          } else if (data.step === "done") {
            brainId = data.brainId;
            console.log(`  ${tag} ✅ DONE! Brain ID: ${brainId}`);
          } else if (data.step === "error") {
            console.log(`  ${tag} ❌ Error: ${data.message}`);
          } else {
            console.log(`  ${tag} ⚙️  ${data.step}: ${data.message || ""}`);
          }
        } catch {}
      }
    }

    if (brainId) {
      return { expert: expert.name, status: "SUCCESS", brainId };
    } else {
      return { expert: expert.name, status: "FAILED", error: `Last step: ${lastStep}` };
    }
  } catch (err) {
    console.error(`${tag} ❌ Exception: ${err.message}`);
    return { expert: expert.name, status: "ERROR", error: err.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("🏆 BATCH CLONE — Elite Squad Creator");
  console.log(`📋 Total experts: ${EXPERTS.length}`);
  console.log("");

  const token = await signIn();
  const results = [];

  for (let i = 0; i < EXPERTS.length; i++) {
    const result = await cloneExpert(token, EXPERTS[i], i, EXPERTS.length);
    results.push(result);

    // Small delay between clones to avoid rate limits
    if (i < EXPERTS.length - 1) {
      console.log(`\n⏳ Waiting 3s before next clone...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Summary
  console.log(`\n\n${"═".repeat(60)}`);
  console.log("📊 BATCH CLONE RESULTS");
  console.log(`${"═".repeat(60)}`);

  const success = results.filter((r) => r.status === "SUCCESS");
  const failed = results.filter((r) => r.status !== "SUCCESS");

  console.log(`✅ Success: ${success.length}/${results.length}`);
  for (const r of success) {
    console.log(`   ✓ ${r.expert} → ${r.brainId}`);
  }
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    for (const r of failed) {
      console.log(`   ✗ ${r.expert} → ${r.error}`);
    }
  }
}

main().catch(console.error);
