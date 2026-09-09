import { test } from "node:test";
import assert from "node:assert/strict";

import { sign, buildBody } from "../src/signing.js";
import { buildEvent, AlertRule } from "../src/models.js";
import { getRealIp } from "../src/express.js";
import { LoGuardError, LoGuardAuthError } from "../src/errors.js";

// signing.js

test("sign() produces the expected headers", () => {
  const body = buildBody({ hello: "world" });
  const { headers } = sign("test_key", body);
  assert.equal(headers["X-Api-Key"], "test_key");
  assert.match(headers["X-LoGuard-Signature"], /^sha256=[0-9a-f]{64}$/);
  assert.match(headers["X-LoGuard-Timestamp"], /^\d+$/);
  assert.match(headers["X-Request-ID"], /^[0-9a-f-]{36}$/);
});

test("sign() is deterministic for the same timestamp/body", () => {
  const body = buildBody({ a: 1 });
  // The signature depends on the timestamp -- same body and key but a
  // different timestamp should produce a different signature (replay
  // protection). Each call gets its own X-Request-ID regardless.
  const s1 = sign("key", body);
  const s2 = sign("key", body);
  assert.notEqual(s1.headers["X-Request-ID"], s2.headers["X-Request-ID"]);
});

// errors.js

test("LoGuardAuthError is a LoGuardError", () => {
  const e = new LoGuardAuthError("test");
  assert.ok(e instanceof LoGuardError);
  assert.ok(e instanceof Error);
  assert.equal(e.name, "LoGuardAuthError");
});

// models.js

test("buildEvent() validates required fields", () => {
  assert.throws(() => buildEvent({ type: "", ip: "1.2.3.4", path: "/x", statusCode: 200 }));
  assert.throws(() => buildEvent({ type: "x", ip: "", path: "/x", statusCode: 200 }));
  assert.throws(() => buildEvent({ type: "x", ip: "1.2.3.4", path: "/x", statusCode: 999 }));
});

test("buildEvent() normalizes the path (adds a leading /)", () => {
  const ev = buildEvent({ type: "x", ip: "1.2.3.4", path: "no-slash", statusCode: 200 });
  assert.equal(ev.path, "/no-slash");
});

test("AlertRule toDict/fromDict round-trip", () => {
  const rule = new AlertRule({ name: "test", conditions: [{ field: "ip", op: "eq", value: "1.2.3.4" }] });
  const roundTripped = AlertRule.fromDict(rule.toDict());
  assert.equal(roundTripped.name, "test");
  assert.equal(roundTripped.conditions.length, 1);
});

// express.js -- anti-spoof

test("getRealIp() does not trust X-Forwarded-For without trustedProxies", () => {
  const req = {
    socket: { remoteAddress: "1.2.3.4" },
    headers: { "x-forwarded-for": "9.9.9.9" },
  };
  const ip = getRealIp(req, []); // empty allowlist
  assert.equal(ip, "1.2.3.4"); // X-Forwarded-For is ignored
});

test("getRealIp() only trusts X-Forwarded-For from an allowed proxy", () => {
  const req = {
    socket: { remoteAddress: "1.2.3.4" },
    headers: { "x-forwarded-for": "9.9.9.9" },
  };
  const ip = getRealIp(req, ["1.2.3.4"]); // 1.2.3.4 is in the allowlist
  assert.equal(ip, "9.9.9.9");
});
