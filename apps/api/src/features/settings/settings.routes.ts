import { Router } from "express";
import { updateSimulatedScenarioSchema } from "@app/contracts";
import { parse } from "../../http/validate.ts";
import type { SettingsService } from "./settings.service.ts";
export function settingsRoutes(service: SettingsService): Router {
  const router = Router();
  router.get("/simulated-scenario", async (_req, res) => res.json(await service.getScenario()));
  router.put("/simulated-scenario", async (req, res) => res.json(await service.updateScenario(parse(updateSimulatedScenarioSchema, req.body).activeScenarioId)));
  return router;
}
