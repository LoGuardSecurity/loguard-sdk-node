/**
 * monitor.js — main client for the LoGuard Node.js SDK.
 */
import { sendSigned, sendSignedMethod, sendNoBody } from "./transport.js";
import { buildEvent, AlertRule } from "./models.js";
import { LoGuardAuthError, LoGuardNotInitializedError, LoGuardValidationError, LoGuardError } from "./errors.js";

const DEFAULT_BASE_URL = "https://loguard.org";
const FAF_FLUSH_INTERVAL_MS = 250;
const FAF_MAX_BATCH = 50;
const FAF_QUEUE_MAX = 2000;

class Monitor {
  constructor() {
    this._apiKey = null;
    this._baseUrl = DEFAULT_BASE_URL;
    this._env = "production";
    this._timeout = 10_000;
    this._retries = 3;
    this._initialized = false;
    this._defaultService = null;

    this._fafQueue = [];
    this._fafTimer = null;

    this.alerts = new AlertsClient(this);
  }

  init({
    apiKey, baseUrl = DEFAULT_BASE_URL, env = "production",
    timeout = 10_000, retries = 3, service = null, allowInsecureTransport = false,
  }) {
    if (!apiKey || !apiKey.trim()) {
      throw new LoGuardAuthError("apiKey is required");
    }
    this._apiKey = apiKey.trim();
    this._baseUrl = baseUrl.replace(/\/$/, "");
    // Matches the Python SDK's behavior: refuse plaintext http:// unless
    // the caller explicitly opts in, since apiKey and request signatures
    // would otherwise go out in the clear on every request.
    if (!this._baseUrl.toLowerCase().startsWith("https://")) {
      if (!allowInsecureTransport) {
        throw new LoGuardValidationError(
          "baseUrl must use https:// -- your apiKey is sent on every request " +
          "and must not travel over plaintext HTTP. If you really need HTTP " +
          "(e.g. a local proxy on a trusted network during development), pass " +
          "allowInsecureTransport: true explicitly."
        );
      }
      console.warn(
        "LoGuard SDK initialized with allowInsecureTransport=true -- apiKey and " +
        "request signatures are being sent over plaintext. Use this ONLY for " +
        "local development on a trusted network, never against a real deployment."
      );
    }
    this._env = env || "production";
    this._timeout = timeout;
    this._retries = retries;
    this._initialized = true;

    // Falls back to whatever OpenTelemetry already settled on
    // (OTEL_SERVICE_NAME), so a deployment with 10 microservices sets this
    // once in its infra (Helm/docker-compose/ECS task def) rather than once
    // per service in code. An explicit init({service}) always wins if
    // given. Deliberately not falling back to HOSTNAME -- in Docker/k8s
    // that's usually a container/pod ID with a random suffix that changes
    // on every restart or replica, which would break grouping "one
    // service, many instances" instead of solving it.
    this._defaultService = (
      service ||
      (typeof process !== "undefined" && process.env && process.env.OTEL_SERVICE_NAME) ||
      (typeof process !== "undefined" && process.env && process.env.SERVICE_NAME) ||
      null
    );

    if (!this._fafTimer) {
      this._fafTimer = setInterval(() => this._fafFlush(), FAF_FLUSH_INTERVAL_MS);
      this._fafTimer.unref?.(); // don't keep the process alive just because of this timer
    }
  }

  get isInitialized() {
    return this._initialized;
  }

  _assertInitialized() {
    if (!this._initialized) {
      throw new LoGuardNotInitializedError("LoGuard is not initialized. Call monitor.init({apiKey}) first.");
    }
  }

  get _ingestUrl() {
    return `${this._baseUrl}/v1/ingest`;
  }

  async event({ type, ip, path, statusCode, userId = null, service = null, meta = {}, ts = null }) {
    this._assertInitialized();
    const ev = buildEvent({ type, ip, path, statusCode, userId, service: service ?? this._defaultService, meta, ts: ts ? new Date(ts) : null });
    ev.meta.env = this._env;
    return this._sendEvents([ev]);
  }

  async eventBatch(events) {
    this._assertInitialized();
    const built = events.map((e) => {
      const ev = buildEvent({ ...e, service: e.service ?? this._defaultService, ts: e.ts ? new Date(e.ts) : null });
      ev.meta.env = this._env;
      return ev;
    });
    return this._sendEvents(built);
  }

  /**
   * Fire-and-forget -- never throws, never blocks.
   * Ideal for production middleware on high-traffic paths.
   */
  eventFireAndForget({ type, ip, path, statusCode, userId = null, service = null, meta = {}, ts = null }) {
    this._assertInitialized();
    try {
      const ev = buildEvent({ type, ip, path, statusCode, userId, service: service ?? this._defaultService, meta, ts: ts ? new Date(ts) : null });
      ev.meta.env = this._env;
      if (this._fafQueue.length < FAF_QUEUE_MAX) {
        this._fafQueue.push(ev);
      }
    } catch {
      // never let a logging failure take down the caller
    }
  }

  async _sendEvents(events) {
    const payload = { events };
    const data = await sendSigned(this._ingestUrl, payload, {
      apiKey: this._apiKey,
      timeout: this._timeout,
      retries: this._retries,
    });
    return data;
  }

  async _fafFlush() {
    if (this._fafQueue.length === 0) return;
    const batch = this._fafQueue.splice(0, FAF_MAX_BATCH);
    try {
      await this._sendEvents(batch);
    } catch {
      // fire-and-forget -- errors here never propagate outward
    }
  }
}

// Alerts sub-client

class AlertsClient {
  constructor(mon) {
    this._mon = mon;
  }

  _url(id = null) {
    const base = `${this._mon._baseUrl}/v1/alert-rules`;
    return id !== null ? `${base}/${id}` : base;
  }

  async create(rule) {
    this._mon._assertInitialized();
    const data = await sendSigned(this._url(), rule.toDict(), {
      apiKey: this._mon._apiKey, timeout: this._mon._timeout, retries: this._mon._retries,
    });
    return AlertRule.fromDict(data ?? {});
  }

  async list() {
    this._mon._assertInitialized();
    const data = await sendNoBody(this._url(), {
      apiKey: this._mon._apiKey, timeout: this._mon._timeout, retries: this._mon._retries, method: "GET",
    });
    const items = Array.isArray(data) ? data : (data?.rules ?? []);
    return items.map((d) => AlertRule.fromDict(d));
  }

  async get(ruleId) {
    this._mon._assertInitialized();
    const data = await sendNoBody(this._url(ruleId), {
      apiKey: this._mon._apiKey, timeout: this._mon._timeout, retries: this._mon._retries, method: "GET",
    });
    return AlertRule.fromDict(data ?? {});
  }

  async update(rule) {
    this._mon._assertInitialized();
    if (rule.id === null) throw new LoGuardValidationError("rule.id is required to update");
    const data = await sendSignedMethod(this._url(rule.id), rule.toDict(), {
      apiKey: this._mon._apiKey, timeout: this._mon._timeout, retries: this._mon._retries, method: "PUT",
    });
    return AlertRule.fromDict(data ?? {});
  }

  async delete(ruleId) {
    this._mon._assertInitialized();
    await sendNoBody(this._url(ruleId), {
      apiKey: this._mon._apiKey, timeout: this._mon._timeout, retries: this._mon._retries, method: "DELETE",
    });
  }

  async enable(ruleId) {
    const rule = await this.get(ruleId);
    rule.enabled = true;
    return this.update(rule);
  }

  async disable(ruleId) {
    const rule = await this.get(ruleId);
    rule.enabled = false;
    return this.update(rule);
  }
}

export const monitor = new Monitor();
