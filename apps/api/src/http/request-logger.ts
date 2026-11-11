import type { Request, RequestHandler } from "express";
import { logger } from "../logger.ts";

/**
 * One line per API request: method, path, the route that matched, status and how long it took. Health checks are left
 * out. `route` is the route's template (`/api/tickets/:id`), so the platform counts a route's errors as one route
 * whatever the ids in its paths; it is left out when no route matched (a 404).
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (req.path === "/api/health") {
    next();
    return;
  }
  const started = performance.now();
  res.on("finish", () => {
    const route = routeTemplate(req);
    logger.info("request", {
      method: req.method,
      path: req.originalUrl.split("?")[0],
      ...(route ? { route } : {}),
      status: res.statusCode,
      ms: Math.round(performance.now() - started),
    });
  });
  next();
};

/**
 * The matched route's template, from the root: the path's leading segments (the routers it was mounted under) and the
 * route's own path. Read from the path rather than `req.baseUrl`, because by the time an error's response finishes,
 * Express has already put `baseUrl` back to the mount above the router that threw.
 */
export function routeTemplate(req: Pick<Request, "originalUrl"> & { route?: { path?: unknown } }): string | undefined {
  const template = req.route?.path;
  if (typeof template !== "string") return undefined;
  const actual = (req.originalUrl.split("?")[0] ?? "").split("/").filter(Boolean);
  const own = template.split("/").filter(Boolean);
  if (own.length > actual.length) return undefined;
  return `/${[...actual.slice(0, actual.length - own.length), ...own].join("/")}`;
}
