import type { HealthResponse } from "@app/contracts";
import { Router } from "express";
import type { Db } from "mongodb";
import type { AiRunner } from "../../ai/maitento.ts";

const PING_TIMEOUT_MS = 2_000;

/**
 * GET /api/health: the platform's health check (poc.json "health"). 200 while the database answers. The one route
 * allowed a 503, which tells the platform this copy isn't ready. Keep it fast and free of side effects.
 */
export function healthRoutes(db: Db, ai: AiRunner | null): Router {
  const router = Router();
  const started = Date.now();

  router.get("/", async (_req, res) => {
    const database = (await ping(db)) ? "up" : "down";
    const body: HealthResponse = {
      status: database === "up" ? "ok" : "degraded",
      checks: { database, ai: ai ? "connected" : "not-connected" },
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
    };
    res.status(database === "up" ? 200 : 503).json(body);
  });

  return router;
}

async function ping(db: Db): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
  });
  try {
    // The ping's own failure is caught too: it may come after the timeout has already answered.
    return await Promise.race([db.command({ ping: 1 }).then(() => true, () => false), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
