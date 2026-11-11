import { Router } from "express";
import type { DashboardService } from "./dashboard.service.ts";

export function dashboardRoutes(service: DashboardService): Router {
  const router = Router();
  router.get("/throughput", async (_req, res) => res.json(await service.throughput()));
  return router;
}
