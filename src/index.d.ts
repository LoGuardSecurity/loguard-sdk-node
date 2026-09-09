// Type definitions for @loguard/sdk

export interface EventInput {
  type: string;
  ip: string;
  path: string;
  statusCode: number;
  userId?: string | null;
  meta?: Record<string, any>;
  ts?: string | Date | null;
}

export interface IngestResult {
  ok: boolean;
  accepted?: number;
  inserted?: number;
  dropped?: number;
  alerts?: any[];
  plan?: string;
  usage?: Record<string, any>;
}

export interface AlertConditionInput {
  field: string;
  op: string;
  value: any;
}

export declare class AlertRule {
  constructor(opts: {
    name: string;
    conditions?: AlertConditionInput[];
    severity?: "low" | "medium" | "high" | "critical";
    actions?: Array<"notify" | "block" | "log">;
    enabled?: boolean;
    description?: string;
    logic?: "and" | "or";
    cooldownSec?: number;
    id?: number | null;
  });
  id: number | null;
  name: string;
  conditions: AlertConditionInput[];
  severity: string;
  actions: string[];
  enabled: boolean;
  description: string;
  logic: string;
  cooldownSec: number;
  toDict(): Record<string, any>;
  static fromDict(d: Record<string, any>): AlertRule;
}

declare class AlertsClient {
  create(rule: AlertRule): Promise<AlertRule>;
  list(): Promise<AlertRule[]>;
  get(ruleId: number): Promise<AlertRule>;
  update(rule: AlertRule): Promise<AlertRule>;
  delete(ruleId: number): Promise<void>;
  enable(ruleId: number): Promise<AlertRule>;
  disable(ruleId: number): Promise<AlertRule>;
}

export interface MonitorInitOptions {
  apiKey: string;
  baseUrl?: string;
  env?: string;
  timeout?: number;
  retries?: number;
}

declare class Monitor {
  init(opts: MonitorInitOptions): void;
  readonly isInitialized: boolean;
  event(input: EventInput): Promise<IngestResult>;
  eventBatch(events: EventInput[]): Promise<IngestResult>;
  eventFireAndForget(input: EventInput): void;
  alerts: AlertsClient;
}

export declare const monitor: Monitor;

export declare const KNOWN_EXPLOIT_HEADERS: string[];

export interface LoGuardMiddlewareOptions {
  trackStatuses?: Set<number>;
  getUserId?: (req: any) => string | null;
  trackHeaders?: string[] | null;
  trustedProxies?: string[];
}
export declare function loGuardMiddleware(opts?: LoGuardMiddlewareOptions): (req: any, res: any, next: any) => void;

export declare class LoGuardError extends Error {}
export declare class LoGuardNotInitializedError extends LoGuardError {}
export declare class LoGuardAuthError extends LoGuardError {}
export declare class LoGuardQuotaError extends LoGuardError {}
export declare class LoGuardConnectionError extends LoGuardError {}
export declare class LoGuardValidationError extends LoGuardError {}
export declare class LoGuardNotFoundError extends LoGuardError {}
export declare class LoGuardConflictError extends LoGuardError {}
