import type { AskAssistant, AskAssistantResult, AssistantStatus } from "@app/contracts";
import { z } from "zod";
import { AI_NOT_CONNECTED, type AiRunner } from "../../ai/maitento.ts";
import { AiFailedError } from "../../errors.ts";
import { logger } from "../../logger.ts";

// The app's AI: ask the assistant a question. It runs the Maitento interaction
// maitento/interactions/one-shot/ask-assistant.mtr, whose typed answer is maitento/json/assistant-answer.json.
// It knows nothing about the app's data yet: a story that grounds it passes the services it needs into the
// constructor and sends what they return as the interaction's optional `context` input.
//
// The pattern to copy for any AI feature:
//   1. no AiRunner (no key): answer "not connected", never throw;
//   2. gather the context from the app's own data, through services;
//   3. run the interaction by name;
//   4. treat the model's answer like any other untrusted input: parse and validate it before using it.

export const ASK_ASSISTANT_INTERACTION = "ask-assistant";

/** The interaction's `schema.solution`. Keep it in step with maitento/json/assistant-answer.json. */
const assistantAnswerSchema = z.object({
  answer: z.string().trim().min(1),
  followUps: z.array(z.string().trim().min(1)).default([]),
});

export class AssistantService {
  private readonly ai: AiRunner | null;

  constructor(ai: AiRunner | null) {
    this.ai = ai;
  }

  status(): AssistantStatus {
    return this.ai ? { connected: true, message: null } : { connected: false, message: AI_NOT_CONNECTED };
  }

  async ask(input: AskAssistant): Promise<AskAssistantResult> {
    if (!this.ai) return { status: "not-connected", message: AI_NOT_CONNECTED };

    const inputs: Record<string, string> = { question: input.question };

    let run;
    try {
      run = await this.ai.runInteraction(ASK_ASSISTANT_INTERACTION, inputs);
    } catch (error) {
      logger.error("assistant run failed", { interaction: ASK_ASSISTANT_INTERACTION, error });
      throw new AiFailedError("The assistant couldn't answer just now. Try again in a moment.", { cause: error });
    }

    const answer = assistantAnswerSchema.safeParse(parseJson(run.output));
    if (!answer.success) {
      logger.error("assistant answered in the wrong shape", { runId: run.runId, issues: answer.error.issues });
      throw new AiFailedError("The assistant's answer wasn't in the expected shape. Try asking again.");
    }
    return { status: "answered", answer: answer.data.answer, followUps: answer.data.followUps.slice(0, 3), runId: run.runId };
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
