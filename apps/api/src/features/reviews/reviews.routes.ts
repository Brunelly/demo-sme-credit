import { Router } from "express";
import { analystIdentities, recordDecisionSchema } from "@app/contracts";
import { parse } from "../../http/validate.ts";
import type { ReviewsService } from "./reviews.service.ts";

export function reviewsRoutes(service: ReviewsService): Router {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await service.list()));
  router.post("/:applicationId/decisions", async (request, response) => {
    const input = parse(recordDecisionSchema, request.body);
    const identity = analystIdentities.find((candidate) => candidate.id === input.analystIdentityId)!;
    response.status(201).json(await service.decide(request.params.applicationId, {
      ...input,
      analystId: identity.id,
      analystName: identity.name,
    }));
  });
  return router;
}
