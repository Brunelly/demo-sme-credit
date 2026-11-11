import { Router } from "express";
import type { ApplicationsService } from "./applications.service.ts";

/** HTTP routes for the credit application queue. */
export function applicationsRoutes(service: ApplicationsService): Router {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await service.list()));
  return router;
}
