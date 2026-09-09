/**
 * errors.js — LoGuard SDK exception hierarchy.
 */
export class LoGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "LoGuardError";
  }
}

export class LoGuardNotInitializedError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardNotInitializedError";
  }
}

export class LoGuardAuthError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardAuthError";
  }
}

export class LoGuardQuotaError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardQuotaError";
  }
}

export class LoGuardConnectionError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardConnectionError";
  }
}

export class LoGuardValidationError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardValidationError";
  }
}

export class LoGuardNotFoundError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardNotFoundError";
  }
}

export class LoGuardConflictError extends LoGuardError {
  constructor(message) {
    super(message);
    this.name = "LoGuardConflictError";
  }
}
