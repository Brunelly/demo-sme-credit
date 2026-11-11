import { Router, type Request } from "express";
import { analystIdentities, recordDecisionSchema } from "@app/contracts";
import { parse } from "../../http/validate.ts";
import { AuthenticationError } from "../../errors.ts";
import type { ReviewsService } from "./reviews.service.ts";

function authenticatedAnalystId(request: Request): string {
  for (const header of ["x-authenticated-user-id", "x-user-id", "x-forwarded-user"] as const) {
    const value = request.get(header)?.trim();
    if (value) return value;
  }
  throw new AuthenticationError("An authenticated analyst identity is required to record a credit decision.");
}

export function reviewsRoutes(service: ReviewsService): Router {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await service.list()));
  router.post("/:applicationId/decisions", async (request, response) => {
    const input = parse(recordDecisionSchema, request.body);
    const identity = analystIdentities.find((candidate) => candidate.id === input.analystIdentityId)!;
    response.status(201).json(await service.decide(request.params.applicationId, {
      ...input,
      analystId: authenticatedAnalystId(request),
      analystName: identity.name,
    }));
  });
  return router;
}
