import { Router, type RequestHandler } from "express";
import { analystIdentities, recordDecisionSchema } from "@app/contracts";
import { parse } from "../../http/validate.ts";
import type { AuthenticatedPrincipal } from "../../http/platform-auth.ts";
import type { ReviewsService } from "./reviews.service.ts";

export function reviewsRoutes(service: ReviewsService, authenticate: RequestHandler): Router {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await service.list()));
  router.post("/:applicationId/decisions", authenticate, async (request, response) => {
    const input = parse(recordDecisionSchema, request.body);
    const principal = response.locals.principal as AuthenticatedPrincipal;
    const identity = analystIdentities.find((candidate) => candidate.id === principal.profileId)!;
    response.status(201).json(await service.decide(request.params.applicationId as string, {
      ...input,
      analystId: principal.sub,
      analystName: identity.name,
      analystRole: principal.role,
      authenticatedProfileId: principal.profileId,
    }));
  });
  return router;
}
