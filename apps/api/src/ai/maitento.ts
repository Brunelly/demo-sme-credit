import { Maitento, MaitentoError } from "@maitento/sdk";
import type { Config } from "../config.ts";
import { logger } from "../logger.ts";

// The app's door to Maitento. Services take an `AiRunner | null` instead of the SDK, so they work (and are tested)
// without a key: null means "AI not connected", and the feature answers that instead of failing.
//
// The interactions and agents themselves are in maitento/ at the repository root; the platform deploys them to
// MAITENTO_NAMESPACE on every deploy. To call another one, add a method here.

export interface AiRun {
  runId: string;
  /** The run's answer. With `schema.solution` in the interaction, a JSON string: parse and validate it. */
  output: string;
}

export interface AiRunner {
  readonly namespace: string;
  /** Starts an interaction by name and waits for its answer. Inputs are the interaction's `inputs.prompts`. */
  runInteraction(name: string, inputs: Record<string, string>): Promise<AiRun>;
}

export const AI_NOT_CONNECTED =
  "AI not connected. Set MAITENTO_API_KEY and MAITENTO_NAMESPACE to switch on the app's AI features.";

/** How long a request waits for a run before giving up on it (and stopping it). */
const RUN_TIMEOUT_MS = 90_000;

export function createAiRunner(settings: Config["maitento"]): AiRunner | null {
  const { apiKey, namespace, baseUrl } = settings;
  if (!apiKey || !namespace) return null;

  let client: Maitento;
  try {
    client = new Maitento({ apiKey, namespace, baseUrl, userAgent: "app" });
  } catch (error) {
    // A malformed key: run without AI rather than not at all, and say why.
    logger.warn("MAITENTO_API_KEY is not usable: AI features are off", {
      reason: error instanceof MaitentoError ? error.message : String(error),
    });
    return null;
  }

  return {
    namespace,
    async runInteraction(name, inputs) {
      const run = await client.interactions.run(name, { inputs }, { timeout: RUN_TIMEOUT_MS, killOnAbort: true });
      return { runId: run.id, output: run.output ?? "" };
    },
  };
}
