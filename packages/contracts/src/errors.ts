/**
 * Every error the API returns has this body. Branch on `code`, which is stable; `message` is for people.
 */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** For `validation_failed`: which fields were wrong, and why. */
    details?: ValidationIssue[];
  };
}

export type ErrorCode =
  | "validation_failed"
  | "not_found"
  | "conflict"
  | "unauthorized"
  | "payload_too_large"
  | "reserved_path"
  | "ai_failed"
  | "dependency_unavailable"
  | "internal_error";

export interface ValidationIssue {
  /** The field, as a dotted path: `title`, `items.0.name`. Empty for the whole body. */
  path: string;
  message: string;
}
