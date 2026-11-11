import type { ErrorCode, ValidationIssue } from "@app/contracts";

// Typed errors. Throw one of these from a service or route and the error handler (http/error-handler.ts) turns it
// into the right status and an { error: { code, message } } body. Never `throw new Error()` for something a caller
// did wrong: pick (or add) a class here. Anything else becomes a 500 with no detail.
//
// These are API errors, so 502, 503 or 504 are fine when something the API depends on fails: the platform passes them
// through on /api. It only shows its own "starting up" page for those codes on pages and screens, outside /api.

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ValidationIssue[] | undefined;

  constructor(status: number, code: ErrorCode, message: string, options?: { details?: ValidationIssue[]; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = options?.details;
  }
}

/** 400: the request is malformed or breaks a rule. */
export class ValidationError extends AppError {
  constructor(message: string, details?: ValidationIssue[]) {
    super(400, "validation_failed", message, { details });
  }
}

/** 404: the thing asked for doesn't exist. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "not_found", message);
  }
}

/** 409: the change clashes with the current state. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "conflict", message);
  }
}

/** 500 with a message people can act on: an AI run failed or answered in the wrong shape. */
export class AiFailedError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(500, "ai_failed", message, options);
  }
}
