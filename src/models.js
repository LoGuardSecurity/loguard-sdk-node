/**
 * models.js — LoGuard SDK data models.
 */

export function buildEvent({ type, ip, path, statusCode, userId = null, service = null, meta = {}, ts = null }) {
  if (!type) throw new Error("event type is required");
  if (!ip) throw new Error("event ip is required");
  if (!path) throw new Error("event path is required");

  const sc = Number(statusCode);
  if (sc < 100 || sc > 599) throw new Error("statusCode must be in range 100..599");

  let p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1024) p = p.slice(0, 1024);

  return {
    type: String(type).trim().toLowerCase().slice(0, 64),
    ip: String(ip).trim().slice(0, 64),
    path: p,
    status_code: sc,
    user_id: userId ? String(userId).slice(0, 128) : null,
    service: service ? String(service).trim().toLowerCase().slice(0, 64) : null,
    meta: { ...meta },
    ts: (ts || new Date()).toISOString(),
  };
}
