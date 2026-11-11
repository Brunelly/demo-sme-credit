import { z } from "zod";

/** GET /api/assistant: whether AI features are switched on. */
export interface AssistantStatus {
  connected: boolean;
  /** Why it isn't connected, for people. Null when it is. */
  message: string | null;
}

/** POST /api/assistant/ask */
export const askAssistantSchema = z.object({
  question: z.string().trim().min(1, "Ask a question.").max(2000),
});
export type AskAssistantInput = z.input<typeof askAssistantSchema>;
export type AskAssistant = z.output<typeof askAssistantSchema>;

/**
 * The answer. Without a Maitento key the app still runs and this says so (`not-connected`), rather than failing:
 * show `message` to the person.
 */
export type AskAssistantResult =
  | { status: "answered"; answer: string; followUps: string[]; runId: string }
  | { status: "not-connected"; message: string };
