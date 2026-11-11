import { randomUUID } from "node:crypto";
import type { DecisionRecord } from "@app/contracts";
import { ConflictError, NotFoundError, ValidationError } from "../../errors.ts";
import type { ReviewsRepository } from "./reviews.repository.ts";

type Input = { analystName: string; decision: "approve" | "refer" | "decline" | "override"; notes: string; overrideOutcome?: "Approve" | "Refer" | "Decline"; overrideReason?: DecisionRecord["overrideReason"] };

export class ReviewsService {
  private readonly repository: ReviewsRepository;
  constructor(repository: ReviewsRepository) { this.repository = repository; }
  list() { return this.repository.list(); }

  async decide(applicationId: string, input: Input): Promise<DecisionRecord> {
    const queue = await this.repository.list();
    const item = queue.items.find((entry) => entry.application.id === applicationId);
    if (!item) throw new NotFoundError("The application is not awaiting an analyst decision.");
    const prior = item.decisions.at(-1);
    const effectiveOutcome = input.decision === "override" ? input.overrideOutcome! : ({ approve: "Approve", refer: "Refer", decline: "Decline" } as const)[input.decision];
    if (input.decision === "override" && (!input.overrideOutcome || !input.overrideReason)) throw new ValidationError("An override outcome and Appendix A reason are required.");
    if (input.decision !== "override" && effectiveOutcome !== item.recommendation.outcome) throw new ValidationError("A decision that differs from the AI recommendation must be recorded as an override with an Appendix A reason.");
    if (prior?.status === "awaiting_second_analyst") {
      if (effectiveOutcome !== "Decline") throw new ConflictError("The second analyst must confirm or reject the pending decline through a new decision.");
      if (prior.analystName.toLocaleLowerCase() === input.analystName.toLocaleLowerCase()) throw new ConflictError("A different analyst must confirm the decline under the four-eyes rule.");
    }
    const isDecline = effectiveOutcome === "Decline";
    const sequence = prior?.status === "awaiting_second_analyst" ? 2 as const : 1 as const;
    const decision: DecisionRecord = {
      id: randomUUID(), applicationId, analystName: input.analystName, decision: input.decision,
      effectiveOutcome, notes: input.notes, ...(input.overrideReason ? { overrideReason: input.overrideReason } : {}),
      recordedAt: new Date().toISOString(), sequence,
      status: isDecline && sequence === 1 ? "awaiting_second_analyst" : "final",
    };
    await this.repository.insert(decision);
    return decision;
  }
}
