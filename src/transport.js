/**
 * transport.js — HTTP transport with retry logic and request signing.
 */
import { sign, buildBody } from "./signing.js";
import {
  LoGuardAuthError,
  LoGuardConnectionError,
  LoGuardNotFoundError,
  LoGuardConflictError,
  LoGuardValidationError,
  LoGuardQuotaError,
} from "./errors.js";

const RETRY_STATUSES = new Set([500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(resp) {
  let text = "";
  try {
    text = await resp.text();
  } catch {
    // ignore
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function raiseForStatus(status, data) {
  const d = data && typeof data === "object" ? data : {};
  const detail = d.detail ?? "";

  if (status === 401) throw new LoGuardAuthError("Invalid API key");
  if (status === 402) throw new LoGuardAuthError("Subscription expired — renew at loguard.org");
  if (status === 403) {
    if (detail === "subscription_expired") {
      throw new LoGuardAuthError("Subscription expired — renew at loguard.org");
    }
    throw new LoGuardAuthError(`Access denied: ${JSON.stringify(detail)}`);
  }
  if (status === 404) throw new LoGuardNotFoundError(`Not found: ${JSON.stringify(detail)}`);
  if (status === 409) throw new LoGuardConflictError(`Conflict: ${JSON.stringify(detail)}`);
  if (status === 422) throw new LoGuardValidationError(`Validation error`);
  if (status === 429) {
    if (detail && detail.err === "usage_limit_exceeded") {
      throw new LoGuardQuotaError(
        `Monthly quota exceeded: ${detail.used}/${detail.limit} events on plan '${detail.plan}'. Upgrade at loguard.org`
      );
    }
    throw new LoGuardConnectionError("Rate limited");
  }
  if (status >= 500) throw new LoGuardConnectionError(`Server error (${status})`);

  return data;
}

/**
 * Send a signed POST request with retry logic.
 */
/**
 * Send a request with no body and no signature (GET/DELETE) -- same
 * retry logic as sendSigned.
 */
export async function sendNoBody(url, { apiKey, timeout = 10_000, retries = 3, method = "GET" }) {
  let lastErr = new LoGuardConnectionError("Unknown error");

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, {
        method,
        headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!RETRY_STATUSES.has(resp.status)) {
        const data = await safeJson(resp);
        return raiseForStatus(resp.status, data);
      }
      lastErr = new LoGuardConnectionError(`Server error ${resp.status}`);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof LoGuardAuthError || e instanceof LoGuardNotFoundError ||
          e instanceof LoGuardConflictError || e instanceof LoGuardValidationError ||
          e instanceof LoGuardQuotaError) {
        throw e;
      }
      lastErr = new LoGuardConnectionError(`Connection error: ${e.message}`);
    }
    if (attempt < retries) await sleep(400 * attempt);
  }
  throw lastErr;
}

/**
 * Send a signed request with a body but an arbitrary method (POST/PUT)
 * -- sendSigned's more general sibling, used for update() calls.
 */
export async function sendSignedMethod(url, payload, { apiKey, timeout = 10_000, retries = 3, method = "POST" }) {
  let lastErr = new LoGuardConnectionError("Unknown error");
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const { bodyBytes, headers } = sign(apiKey, buildBody(payload));
      const resp = await fetch(url, { method, body: bodyBytes, headers, signal: controller.signal });
      clearTimeout(timer);
      if (!RETRY_STATUSES.has(resp.status)) {
        const data = await safeJson(resp);
        return raiseForStatus(resp.status, data);
      }
      lastErr = new LoGuardConnectionError(`Server error ${resp.status}`);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof LoGuardAuthError || e instanceof LoGuardNotFoundError ||
          e instanceof LoGuardConflictError || e instanceof LoGuardValidationError ||
          e instanceof LoGuardQuotaError) {
        throw e;
      }
      lastErr = new LoGuardConnectionError(`Connection error: ${e.message}`);
    }
    if (attempt < retries) await sleep(400 * attempt);
  }
  throw lastErr;
}

export async function sendSigned(url, payload, { apiKey, timeout = 10_000, retries = 3 }) {
  let lastErr = new LoGuardConnectionError("Unknown error");

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const { bodyBytes, headers } = sign(apiKey, buildBody(payload));
      const resp = await fetch(url, {
        method: "POST",
        body: bodyBytes,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!RETRY_STATUSES.has(resp.status)) {
        const data = await safeJson(resp);
        return raiseForStatus(resp.status, data);
      }
      lastErr = new LoGuardConnectionError(`Server error ${resp.status}`);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof LoGuardAuthError || e instanceof LoGuardNotFoundError ||
          e instanceof LoGuardConflictError || e instanceof LoGuardValidationError ||
          e instanceof LoGuardQuotaError) {
        throw e;
      }
      lastErr = new LoGuardConnectionError(`Connection error: ${e.message}`);
    }

    if (attempt < retries) {
      await sleep(400 * attempt);
    }
  }

  throw lastErr;
}
