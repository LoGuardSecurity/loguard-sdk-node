/**
 * Request signing for the LoGuard Node.js SDK.
 * Same protocol as the Python/Rust SDKs -- HMAC-SHA256 with a timestamp
 * to guard against replay attacks. Uses the same header names
 * (X-LoGuard-Timestamp/X-LoGuard-Signature) that loguard-ingest expects.
 *
 * The server checks:
 *   1. Timestamp is fresh (< 5 min)
 *   2. Signature matches the body
 */
import { createHmac, randomUUID } from "node:crypto";

const SDK_VERSION = "0.1.0";

/**
 * Serializes the payload to deterministic JSON.
 * The server recomputes the signature over the exact bytes that were
 * actually sent -- key order doesn't need to match byte-for-byte with the
 * Python version, only internal consistency matters (whatever gets
 * signed is exactly what gets sent).
 */
export function buildBody(payload) {
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

/**
 * Signs the request body.
 *
 * @param {string} apiKey - Raw API key
 * @param {Buffer} bodyBytes - JSON-serialized body
 * @returns {{bodyBytes: Buffer, headers: Record<string,string>}}
 */
export function sign(apiKey, bodyBytes) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf-8"),
    bodyBytes,
  ]);

  const signature = createHmac("sha256", apiKey)
    .update(signedPayload)
    .digest("hex");

  const headers = {
    "X-Api-Key": apiKey,
    "X-LoGuard-Timestamp": String(timestamp),
    "X-LoGuard-Signature": `sha256=${signature}`,
    "X-Request-ID": randomUUID(),
    "Content-Type": "application/json",
    "User-Agent": `loguard-node-sdk/${SDK_VERSION}`,
  };

  return { bodyBytes, headers };
}
