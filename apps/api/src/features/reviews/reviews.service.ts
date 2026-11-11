import { randomUUID } from "node:crypto";
import type { AnalystIdentityId, DecisionRecord } from "@app/contracts";
import { ConflictError, NotFoundError, ValidationError } from "../../errors.ts";
import type { ReviewsRepository } from "./reviews.repository.ts";

type Input = { assessmentRunId: string; analystIdentityId: AnalystIdentityId; analystId: string; analystName: string; expectedSequence: 1 | 2; decision: "approve" | "refer" | "decline" | "override"; notes: string; overrideOutcome?: "Approve" | "Refer" | "Decline"; overrideReason?: DecisionRecord["overrideReason"] };

export class ReviewsService {
  private readonly repository: ReviewsRepository;
  constructor(repository: ReviewsRepository) { this.repository = repository; }
  list() { return this.repository.list(); }

  async decide(applicationId: string, input: Input): Promise<DecisionRecord> {
    const item = await this.repository.findAwaitingDecision(applicationId);
    if (!item) throw new NotFoundError("The application is not awaiting an analyst decision.");
    if (input.assessmentRunId !== item.assessmentRunId) throw new ConflictError("This decision belongs to a different assessment. Refresh the review queue before continuing.");
    const prior = item.decisions.at(-1);
    const currentSequence = prior?.status === "awaiting_second_analyst" ? 2 : 1;
    if (input.expectedSequence !== currentSequence) throw new ConflictError("The decision ledger changed. Refresh the review queue before continuing.");
    const effectiveOutcome = input.decision === "override" ? input.overrideOutcome! : ({ approve: "Approve", refer: "Refer", decline: "Decline" } as const)[input.decision];
    if (input.decision === "override" && (!input.overrideOutcome || !input.overrideReason)) throw new ValidationError("An override outcome and Appendix A reason are required.");
    if (prior?.status === "awaiting_second_analyst") {
      if (prior.analystId === input.analystId) throw new ConflictError("A different analyst must confirm or reject the decline under the four-eyes rule.");
      const rejectsOverrideDecline = prior.decision === "override" && prior.effectiveOutcome === "Decline" && effectiveOutcome === item.recommendation.outcome;
      if (effectiveOutcome !== "Decline" && !rejectsOverrideDecline) throw new ConflictError("Confirm the pending decline, or reject it by retaining the original recommendation.");
    } else if (input.decision !== "override" && effectiveOutcome !== item.recommendation.outcome) {
      throw new ValidationError("A decision that differs from the AI recommendation must be recorded as an override with an Appendix A reason.");
    }
    const isDecline = effectiveOutcome === "Decline";
    const sequence = input.expectedSequence;
    const decision: DecisionRecord = {
      id: randomUUID(), applicationId, assessmentRunId: item.assessmentRunId, analystId: input.analystId, analystName: input.analystName, decision: input.decision,
      effectiveOutcome, notes: input.notes, ...(input.overrideReason ? { overrideReason: input.overrideReason } : {}),
      recordedAt: new Date().toISOString(), sequence,
      status: isDecline && sequence === 1 ? "awaiting_second_analyst" : "final",
    };
    await this.repository.insert(decision);
    return decision;
  }
}
