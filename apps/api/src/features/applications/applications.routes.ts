import { Router } from "express";
import { recordRecommendationOverrideSchema, runApplicationChecksSchema } from "@app/contracts";
import { parse } from "../../http/validate.ts";
import type { ApplicationsService } from "./applications.service.ts";

/** HTTP routes for the credit application queue. */
export function applicationsRoutes(service: ApplicationsService): Router {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await service.list()));
  router.get("/:id/checks", async (request, response) => response.json(await service.latestChecks(request.params.id!)));
  router.post("/:id/checks", async (request, response) => response.status(201).json(await service.runChecks(request.params.id!, parse(runApplicationChecksSchema, request.body))));
  router.post("/:id/checks/:runId/override", async (request, response) => response.status(201).json(await service.recordOverride(request.params.id!, request.params.runId!, parse(recordRecommendationOverrideSchema, request.body))));
  return router;
}
