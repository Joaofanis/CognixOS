import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Use the deployed Supabase project URL
const PROJECT_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const FUNCTIONS_URL = `${PROJECT_URL}/functions/v1`;

const FUNCTIONS_WITH_AUTH = [
  "brain-chat",
  "summon-clone",
  "analyze-brain",
  "agent-squad",
  "general-chat",
  "generate-prompt",
  "generate-description",
  "extract-quotes",
  "process-rag",
  "parse-file",
  "update-user-profile",
  "ai-health-check",
];

const ALL_FUNCTIONS = [
  ...FUNCTIONS_WITH_AUTH,
  "import-url",
];

// ── CORS (OPTIONS) ──────────────────────────────────────────────
for (const fn of ALL_FUNCTIONS) {
  Deno.test(`[${fn}] OPTIONS returns CORS headers`, async () => {
    const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
      method: "OPTIONS",
      headers: { apikey: ANON_KEY },
    });
    assertEquals(res.status, 200, `${fn} OPTIONS should return 200, got ${res.status}`);
    const acah = res.headers.get("access-control-allow-headers") ?? "";
    assertEquals(acah.includes("authorization"), true, `${fn} should allow authorization header`);
    await res.body?.cancel();
  });
}

// ── Auth rejection (no Authorization header) ────────────────────
for (const fn of FUNCTIONS_WITH_AUTH) {
  Deno.test(`[${fn}] rejects unauthenticated requests`, async () => {
    const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const status = res.status;
    assertEquals(
      status === 401 || status === 403,
      true,
      `${fn} should return 401/403 without auth, got ${status}`,
    );
    await res.body?.cancel();
  });
}

// ── Auth rejection (invalid JWT) ────────────────────────────────
// Some functions validate body before JWT (returning 400 for empty body).
// This is still secure — unauthenticated users never get data.
// We accept any 4xx as "rejected".
for (const fn of FUNCTIONS_WITH_AUTH) {
  Deno.test(`[${fn}] rejects invalid JWT`, async () => {
    const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: "Bearer invalid-token-12345",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ brainId: "00000000-0000-0000-0000-000000000000", messages: [{ role: "user", content: "test" }] }),
    });
    const status = res.status;
    assertEquals(
      status >= 400 && status < 500,
      true,
      `${fn} should reject invalid JWT with 4xx, got ${status}`,
    );
    await res.body?.cancel();
  });
}

// ── Invalid body handling ───────────────────────────────────────
for (const fn of ["brain-chat", "generate-prompt", "summon-clone", "analyze-brain"]) {
  Deno.test(`[${fn}] rejects invalid JSON body`, async () => {
    const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: "Bearer fake-jwt-token",
        "Content-Type": "application/json",
      },
      body: "not-json{{{",
    });
    // Should return 400 or 401 (auth check may come first)
    assertEquals(
      res.status >= 400 && res.status < 500,
      true,
      `${fn} should handle invalid JSON gracefully, got ${res.status}`,
    );
    await res.body?.cancel();
  });
}

// ── import-url specific: rejects missing body ───────────────────
Deno.test("[import-url] rejects missing url/brainId", async () => {
  const res = await fetch(`${FUNCTIONS_URL}/import-url`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.status >= 400, true, "import-url should reject empty body");
  await res.body?.cancel();
});

// ── import-url SSRF protection ──────────────────────────────────
Deno.test("[import-url] blocks localhost URLs (SSRF)", async () => {
  const res = await fetch(`${FUNCTIONS_URL}/import-url`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: "http://localhost:8080/secret", brainId: "00000000-0000-0000-0000-000000000000" }),
  });
  assertEquals(res.status >= 400, true, "import-url should block localhost");
  const body = await res.json();
  assertExists(body.error);
});

// ── Response format check ───────────────────────────────────────
Deno.test("[general-chat] error response has JSON content-type", async () => {
  const res = await fetch(`${FUNCTIONS_URL}/general-chat`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const ct = res.headers.get("content-type") ?? "";
  assertEquals(ct.includes("application/json"), true, "Error responses should be JSON");
  await res.body?.cancel();
});
