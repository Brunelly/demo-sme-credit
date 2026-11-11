import type { ApiErrorBody } from "@app/contracts";
import type { RequestHandler } from "express";

/**
 * /__brunelly/ belongs to the platform that hosts the app (sign-in, sharing, "starting up"). Those requests never
 * reach a deployed app, and the app must never answer them itself: this answers 404 before any route, static file
 * or SPA fallback can. Mounted first in app.ts; never add a route under it.
 */
export const RESERVED_PREFIX = "/__brunelly";

export const reservedPaths: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: "reserved_path", message: `${RESERVED_PREFIX}/ is reserved for the platform.` },
  } satisfies ApiErrorBody);
};
