import { Router } from "express";
import type { ApplicationsService } from "./applications.service.ts";
export function applicationsRoutes(service: ApplicationsService): Router {
  const router = Router();
  router.get("/", async (_req, res) => res.json(await service.list()));
  router.get("/:id/checks", async (req, res) => res.json(await service.latestChecks(req.params.id!)));
  router.post("/:id/checks", async (req, res) => res.status(201).json(await service.runChecks(req.params.id!)));
  router.get("/:applicationId/assessment-runs", async (req, res) => res.json(await service.listRuns(req.params.applicationId!)));
  router.post("/:applicationId/assessment-runs", async (req, res) => res.status(202).json(await service.runChecks(req.params.applicationId!)));
  router.get("/:applicationId/assessment-runs/:runId", async (req, res) => res.json(await service.getRun(req.params.applicationId!, req.params.runId!)));
  return router;
}
