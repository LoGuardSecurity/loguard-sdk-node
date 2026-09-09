/**
 * test_node_sdk_e2e.mjs
 *
 * Real end-to-end test: an actual Express app, the actual loGuardMiddleware
 * from the SDK, a real HTTP request via supertest, a real network POST to
 * a live ingest server.
 */
import express from "express";
import request from "supertest";
import { monitor } from "./src/monitor.js";
import { loGuardMiddleware, KNOWN_EXPLOIT_HEADERS } from "./src/express.js";

const apiKey = process.argv[2] || process.env.LOGUARD_API_KEY;
if (!apiKey) {
  console.error("ERROR: pass an API key as the first argument");
  process.exit(1);
}

monitor.init({
  apiKey,
  baseUrl: "http://localhost:8000",
  env: "e2e-node-sdk-test",
  allowInsecureTransport: true,
});

const app = express();
app.use(
  loGuardMiddleware({
    trackStatuses: new Set([500]),
    trackHeaders: KNOWN_EXPLOIT_HEADERS,
  })
);
app.get("/ecp/", (req, res) => {
  res.status(500).json({ error: "internal" });
});

console.log("Sending a request through the real Express loGuardMiddleware (ProxyLogon headers)...");

const resp = await request(app)
  .get("/ecp/")
  .set("X-AnonResource-Backend", "localhost/ecp/default.flt?~3")
  .set("X-BEResource", "localhost~1942")
  .set("User-Agent", "Mozilla/5.0 (real Node SDK e2e test)")
  .set("Cookie", "session=SHOULD_NEVER_BE_SENT");

console.log("App response:", resp.status);
console.log();
console.log("Waiting for the fire-and-forget background send...");
await new Promise((r) => setTimeout(r, 2000));
console.log("Done. Check detector.log for a detector_hit with name=cve_signature.");
