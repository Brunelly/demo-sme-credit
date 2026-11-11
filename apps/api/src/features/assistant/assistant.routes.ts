import type { AskAssistantResult, AssistantStatus } from "@app/contracts";
import { askAssistantSchema } from "@app/contracts";
import { Router } from "express";
import { parse } from "../../http/validate.ts";
import type { AssistantService } from "./assistant.service.ts";

export function assistantRoutes(assistant: AssistantService): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(assistant.status() satisfies AssistantStatus);
  });

  // 200 either way: { status: "answered", … } or, without a Maitento key, { status: "not-connected", message }.
  router.post("/ask", async (req, res) => {
    const result = await assistant.ask(parse(askAssistantSchema, req.body));
    res.json(result satisfies AskAssistantResult);
  });

  return router;
}
