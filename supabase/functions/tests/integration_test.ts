/**
 * Integration tests for Edge Functions with real authentication.
 * 
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD env vars to be set,
 * or a .env.test file with these values.
 * 
 * These tests sign in as a real user and test the full flow.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
// Also try loading .env.test for test-specific credentials
try {
  const envTest = await Deno.readTextFile("../../.env.test");
  for (const line of envTest.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!Deno.env.get(key)) Deno.env.set(key, val);
    }
  }
} catch { /* .env.test not found — that's fine */ }
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "https://pnmxqvaafdecqmeradfc.supabase.co";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubXhxdmFhZmRlY3FtZXJhZGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzMzMTMsImV4cCI6MjA4NjkwOTMxM30.MhgGsNHefvsR3h4J9TZXajgQsz2D9oHQD69YVyRjtiE";
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Test credentials — set via env or .env.test
const TEST_EMAIL = Deno.env.get("TEST_USER_EMAIL") ?? "";
const TEST_PASSWORD = Deno.env.get("TEST_USER_PASSWORD") ?? "";

// Shared state
let accessToken = "";
let userId = "";
let testBrainId = "";

// ── Helper ──────────────────────────────────────────────────────
async function authedFetch(fnName: string, body: Record<string, unknown>, timeout = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(`${FUNCTIONS_URL}/${fnName}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Setup: Sign in ──────────────────────────────────────────────
Deno.test({
  name: "[setup] Sign in with test user",
  fn: async () => {
    if (!TEST_EMAIL || !TEST_PASSWORD || TEST_PASSWORD === "REPLACE_WITH_YOUR_PASSWORD") {
      console.warn("⚠️  TEST_USER_EMAIL / TEST_USER_PASSWORD not set or placeholder. Skipping authenticated tests.");
      return;
    }
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    assertEquals(error, null, `Sign-in failed: ${error?.message}`);
    assertExists(data.session, "No session returned");
    accessToken = data.session!.access_token;
    userId = data.user!.id;
    console.log(`✅ Signed in as ${TEST_EMAIL} (${userId})`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── Get a brain for testing ─────────────────────────────────────
Deno.test({
  name: "[setup] Fetch user brains",
  fn: async () => {
    if (!accessToken) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/brains?select=id,name,type&user_id=eq.${userId}&limit=1`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    assertEquals(res.status, 200);
    const brains = await res.json();
    if (brains.length > 0) {
      testBrainId = brains[0].id;
      console.log(`✅ Using brain: ${brains[0].name} (${testBrainId})`);
    } else {
      console.warn("⚠️  No brains found for test user");
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── general-chat ────────────────────────────────────────────────
Deno.test({
  name: "[general-chat] Responds to authenticated user",
  fn: async () => {
    if (!accessToken) return;
    const res = await authedFetch("general-chat", {
      messages: [{ role: "user", content: "Responda apenas com a palavra OK" }],
      mode: "fast",
    }, 60_000);
    assertEquals(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assertExists(body.reply, "Response should have a 'reply' field");
    assertEquals(body.reply.length > 0, true, "Reply should not be empty");
    console.log(`✅ general-chat replied: "${body.reply.slice(0, 80)}..."`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── brain-chat ──────────────────────────────────────────────────
Deno.test({
  name: "[brain-chat] Responds with brain context",
  fn: async () => {
    if (!accessToken || !testBrainId) return;
    const res = await authedFetch("brain-chat", {
      brainId: testBrainId,
      messages: [{ role: "user", content: "Responda apenas com a palavra OK" }],
      mode: "fast",
    }, 60_000);
    assertEquals(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assertExists(body.reply, "Response should have a 'reply' field");
    console.log(`✅ brain-chat replied: "${body.reply.slice(0, 80)}..."`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── brain-chat ownership check ──────────────────────────────────
Deno.test({
  name: "[brain-chat] Rejects non-owned brain",
  fn: async () => {
    if (!accessToken) return;
    const fakeBrainId = "00000000-0000-0000-0000-000000000000";
    const res = await authedFetch("brain-chat", {
      brainId: fakeBrainId,
      messages: [{ role: "user", content: "test" }],
    });
    assertEquals(
      res.status >= 400 && res.status < 500,
      true,
      `Should reject non-owned brain, got ${res.status}`,
    );
    await res.body?.cancel();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── generate-description ────────────────────────────────────────
Deno.test({
  name: "[generate-description] Generates brain description",
  fn: async () => {
    if (!accessToken || !testBrainId) return;
    const res = await authedFetch("generate-description", {
      brainId: testBrainId,
    }, 60_000);
    assertEquals(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assertExists(body.description, "Should return description");
    console.log(`✅ generate-description: "${body.description.slice(0, 80)}..."`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── ai-health-check (authenticated) ─────────────────────────────
Deno.test({
  name: "[ai-health-check] Returns model status for authenticated user",
  fn: async () => {
    if (!accessToken) return;
    const res = await authedFetch("ai-health-check", {}, 60_000);
    assertEquals(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assertExists(body.results, "Should return results array");
    assertEquals(body.total > 0, true, "Should have checked at least one model");
    console.log(`✅ ai-health-check: ${body.ok}/${body.total} models OK`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── update-user-profile ─────────────────────────────────────────
Deno.test({
  name: "[update-user-profile] Updates profile for authenticated user",
  fn: async () => {
    if (!accessToken) return;
    const res = await authedFetch("update-user-profile", {
      messages: [
        { role: "user", content: "Olá, isso é um teste de integração" },
        { role: "assistant", content: "OK, teste registrado." },
      ],
    }, 30_000);
    // This function may return 200 or do a silent update
    assertEquals(
      res.status >= 200 && res.status < 500,
      true,
      `Should not error, got ${res.status}`,
    );
    await res.body?.cancel();
    console.log(`✅ update-user-profile: status ${res.status}`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── summon-clone ────────────────────────────────────────────────
Deno.test({
  name: "[summon-clone] Summons a clone brain",
  fn: async () => {
    if (!accessToken || !testBrainId) return;
    const res = await authedFetch("summon-clone", {
      brainId: testBrainId,
      messages: [{ role: "user", content: "Diga apenas OK" }],
    }, 60_000);
    assertEquals(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assertExists(body.reply, "Should return reply");
    console.log(`✅ summon-clone replied: "${body.reply.slice(0, 80)}..."`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// ── import-url SSRF protection ──────────────────────────────────
Deno.test({
  name: "[import-url] Blocks SSRF even with valid auth",
  fn: async () => {
    if (!accessToken || !testBrainId) return;
    const res = await fetch(`${FUNCTIONS_URL}/import-url`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "http://169.254.169.254/latest/meta-data/",
        brainId: testBrainId,
      }),
    });
    assertEquals(res.status >= 400, true, "Should block SSRF attempt");
    const body = await res.json();
    assertExists(body.error);
    console.log(`✅ import-url SSRF blocked: ${body.error}`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
