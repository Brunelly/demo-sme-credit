import type { ApiErrorBody } from "@app/contracts";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors.ts";
import { logger } from "../logger.ts";

function send(res: Parameters<RequestHandler>[1], status: number, error: ApiErrorBody["error"]): void {
  res.status(status).json({ error } satisfies ApiErrorBody);
}

/** An /api path no route matched. */
export const apiNotFound: RequestHandler = (req, res) => {
  send(res, 404, { code: "not_found", message: `There is no ${req.method} ${req.originalUrl.split("?")[0]}.` });
};

/**
 * Turns anything thrown in a route into an error response. Express 5 passes errors from async handlers here, so
 * routes just `throw` (or let a service's error bubble up): no try/catch, no next(error).
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    send(res, error.status, { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) });
    return;
  }
  // express.json() and express.static() errors carry a `type` or a `status`.
  const { type, status } = (error ?? {}) as { type?: unknown; status?: unknown };
  if (status === 404) {
    send(res, 404, { code: "not_found", message: `There is no ${req.originalUrl.split("?")[0]}.` });
    return;
  }
  if (type === "entity.parse.failed") {
    send(res, 400, { code: "validation_failed", message: "The request body is not valid JSON." });
    return;
  }
  if (type === "entity.too.large") {
    send(res, 413, { code: "payload_too_large", message: "The request body is too large." });
    return;
  }
  logger.error("unhandled error", { method: req.method, path: req.path, error });
  send(res, 500, { code: "internal_error", message: "Something went wrong. Try again in a moment." });
};
