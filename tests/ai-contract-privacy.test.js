import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildEvent } from "../src/models.js";
import { buildBody, sign } from "../src/signing.js";
import { sendSigned } from "../src/transport.js";
import { LoGuardError } from "../src/errors.js";

test("AI event metadata survives encoding and exact-body signing", () => {
  const inputs = [
    ["ai_llm_request", { prompt: "Synthetic հայկական request" }],
    ["ai_llm_response", { response: "Synthetic response", usage: { output_tokens: 2 } }],
    ["ai_tool_call", { tool_name: "search_documents", tool_args: {}, success: true }],
  ];
  for (const [type, meta] of inputs) {
    const event = buildEvent({ type, meta, ip: "203.0.113.10", path: "/ai/test", statusCode: 200 });
    assert.equal(event.type, type);
    assert.deepEqual(event.meta, meta);
    const body = buildBody({ events: [event] });
    const signed = sign("synthetic-key", body);
    const expected = createHmac("sha256", "synthetic-key")
      .update(Buffer.concat([Buffer.from(`${signed.headers["X-LoGuard-Timestamp"]}.`), body]))
      .digest("hex");
    assert.deepEqual(signed.bodyBytes, body);
    assert.equal(signed.headers["X-LoGuard-Signature"], `sha256=${expected}`);
  }
});

test("HTTP failures do not expose response content", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [403, 404, 409, 422, 429, 500]) {
      globalThis.fetch = async () => new Response(JSON.stringify({
        detail: { err: "usage_limit_exceeded", plan: "SYNTHETIC_PRIVATE_MARKER", input: "SYNTHETIC_PRIVATE_MARKER" },
      }), { status });
      await assert.rejects(
        sendSigned("https://synthetic.invalid/v1/ingest", { events: [] }, {
          apiKey: "synthetic-key", retries: 1,
        }),
        (error) => error instanceof LoGuardError && !String(error).includes("SYNTHETIC_PRIVATE_MARKER"),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
