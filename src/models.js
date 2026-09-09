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

export class AlertRule {
  constructor({
    name,
    conditions = [],
    severity = "medium",
    actions = ["notify"],
    enabled = true,
    description = "",
    logic = "and",
    cooldownSec = 60,
    id = null,
  }) {
    this.id = id;
    this.name = name;
    this.conditions = conditions;
    this.severity = severity;
    this.actions = actions;
    this.enabled = enabled;
    this.description = description;
    this.logic = logic;
    this.cooldownSec = cooldownSec;
  }

  toDict() {
    return {
      name: this.name,
      conditions: this.conditions,
      severity: this.severity,
      actions: this.actions,
      enabled: this.enabled,
      description: this.description,
      logic: this.logic,
      cooldown_sec: this.cooldownSec,
    };
  }

  static fromDict(d) {
    return new AlertRule({
      id: d.id ?? null,
      name: d.name,
      conditions: d.conditions ?? [],
      severity: d.severity ?? "medium",
      actions: d.actions ?? ["notify"],
      enabled: d.enabled ?? true,
      description: d.description ?? "",
      logic: d.logic ?? "and",
      cooldownSec: d.cooldown_sec ?? 60,
    });
  }
}


