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
