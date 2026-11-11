import { Router } from "express";
import { recordDecisionSchema } from "@app/contracts";
import { parse } from "../../http/validate.ts";
import type { ReviewsService } from "./reviews.service.ts";

export function reviewsRoutes(service: ReviewsService): Router {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await service.list()));
  router.post("/:applicationId/decisions", async (request, response) => response.status(201).json(await service.decide(request.params.applicationId, parse(recordDecisionSchema, request.body))));
  return router;
}
