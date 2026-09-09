/**
 * express.js — Express integration for the LoGuard Node.js SDK.
 */
import { monitor } from "./monitor.js";

// Headers that have historically carried real RCE exploits (ShellShock,
// ProxyLogon) -- see the same rationale in the Python SDK.
export const KNOWN_EXPLOIT_HEADERS = ["user-agent", "referer", "x-beresource", "x-anonresource-backend"];

// Enforced here, not just documented -- these are never sent even if
// explicitly listed in trackHeaders.
const FORBIDDEN_TRACK_HEADERS = new Set([
  "authorization", "cookie", "set-cookie", "x-api-key", "x-auth-token", "proxy-authorization",
]);

export function getRealIp(req, trustedProxies) {
  const clientIp = req.socket?.remoteAddress || req.ip || "127.0.0.1";
  if (trustedProxies.includes(clientIp)) {
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
      const candidate = String(xff).split(",")[0].trim();
      if (candidate) return candidate;
    }
  }
  return clientIp;
}

function collectTrackedHeaders(req, trackHeaders) {
  if (!trackHeaders.length) return {};
  const collected = {};
  for (const name of trackHeaders) {
    const val = req.headers[name];
    if (val !== undefined) collected[name] = String(val).slice(0, 512);
  }
  return collected;
}

/**
 * Middleware that tracks HTTP errors as LoGuard security events.
 */
export function loGuardMiddleware({
  trackStatuses = new Set([400, 401, 403, 404, 429, 500, 502, 503]),
  getUserId = null,
  trackHeaders = null,
  trustedProxies = [],
} = {}) {
  const requested = (trackHeaders || []).map((h) => h.toLowerCase());
  const blocked = requested.filter((h) => FORBIDDEN_TRACK_HEADERS.has(h));
  if (blocked.length) {
    console.warn(`loGuardMiddleware: refusing to track sensitive header(s) ${blocked} — never forwarded regardless of configuration.`);
  }
  const finalTrackHeaders = requested.filter((h) => !FORBIDDEN_TRACK_HEADERS.has(h));

  return function (req, res, next) {
    const ip = getRealIp(req, trustedProxies);

    res.on("finish", () => {
      if (!trackStatuses.has(res.statusCode)) return;
      try {
        let userId = null;
        if (getUserId) {
          try { userId = getUserId(req); } catch { /* ignore */ }
        }
        const eventType = res.statusCode === 401 ? "login_failed" : "http_error";
        const meta = {};
        const tracked = collectTrackedHeaders(req, finalTrackHeaders);
        if (Object.keys(tracked).length) meta.headers = tracked;

        monitor.eventFireAndForget({
          type: eventType, ip, path: req.path, statusCode: res.statusCode, userId, meta,
        });
      } catch {
        // never let a logging failure take down the response to the user
      }
    });

    next();
  };
}
