import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestLogger, routeTemplate } from "../src/http/request-logger.ts";
import { logger } from "../src/logger.ts";

/** A small app shaped like this one: the logger first, then routers mounted under /api, then an error handler. */
function appWithRoutes() {
  const app = express();
  app.use(requestLogger);
  const tickets = express.Router();
  tickets.get("/:id", (req, res) => {
    res.json({ id: req.params.id });
  });
  tickets.post("/:id/close", () => {
    throw new Error("boom");
  });
  const api = express.Router();
  api.use("/tickets", tickets);
  app.use("/api", api);
  app.use(((_error, _req, res, _next) => {
    res.status(500).json({ error: { code: "internal_error" } });
  }) as express.ErrorRequestHandler);
  return app;
}

/** The fields of every "request" line the logger was asked to write. */
function loggedRequests(info: { mock: { calls: [string, Record<string, unknown>?][] } }): Record<string, unknown>[] {
  return info.mock.calls.filter(([message]) => message === "request").map(([, fields]) => fields ?? {});
}

describe("requestLogger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the route's template, so the ids in a path never split a route's count", async () => {
    const info = vi.spyOn(logger, "info");
    await request(appWithRoutes()).get("/api/tickets/42?x=1").expect(200);
    expect(loggedRequests(info)).toEqual([
      expect.objectContaining({ method: "GET", path: "/api/tickets/42", route: "/api/tickets/:id", status: 200 }),
    ]);
  });

  it("logs the route of a request that failed with a server error", async () => {
    const info = vi.spyOn(logger, "info");
    await request(appWithRoutes()).post("/api/tickets/7/close").expect(500);
    expect(loggedRequests(info)).toEqual([
      expect.objectContaining({ method: "POST", path: "/api/tickets/7/close", route: "/api/tickets/:id/close", status: 500 }),
    ]);
  });

  it("leaves the route out when none matched", async () => {
    const info = vi.spyOn(logger, "info");
    await request(appWithRoutes()).get("/api/nothing-here").expect(404);
    const [line] = loggedRequests(info);
    expect(line).toMatchObject({ path: "/api/nothing-here", status: 404 });
    expect(line).not.toHaveProperty("route");
  });
});

describe("routeTemplate", () => {
  it("puts the mount path in front of the route's own path", () => {
    expect(routeTemplate({ originalUrl: "/api/orders/9f1c/lines/3", route: { path: "/:orderId/lines/:line" } })).toBe("/api/orders/:orderId/lines/:line");
    expect(routeTemplate({ originalUrl: "/api/orders/", route: { path: "/" } })).toBe("/api/orders");
  });

  it("has no template without a matched string route", () => {
    expect(routeTemplate({ originalUrl: "/api/x" })).toBeUndefined();
    expect(routeTemplate({ originalUrl: "/api/x", route: { path: /x/ } })).toBeUndefined();
  });
});
