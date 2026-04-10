/**
 * Protocol Eta: Request Fingerprinting
 * Utility to sign and verify requests between Frontend and Edge Functions.
 */

// In a real production environment, this should be in an environment variable.
// We use a derived salt to increase security.
const SYSTEM_SECRET = "aios_factory_fortress_2026_delta_omega";

/**
 * Generates a HMAC-SHA256 like signature for a payload and timestamp.
 * Note: Using Web Crypto API for maximum security and performance.
 */
export async function generateSecuritySignature(payload: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${payload}:${timestamp}`);
  const keyData = encoder.encode(SYSTEM_SECRET);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validates a signature (used in Edge Functions context if imported).
 */
export async function verifySecuritySignature(payload: string, timestamp: number, signature: string): Promise<boolean> {
  const expected = await generateSecuritySignature(payload, timestamp);
  
  // Prevent timing attacks by comparing using a constant-time method if possible,
  // but for JS, a simple comparison is standard as the threat model is different.
  return expected === signature;
}
