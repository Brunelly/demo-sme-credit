import { randomUUID } from "node:crypto";
import { decisionAuthoritySchema, type AnalystIdentityId, type DecisionAuthority, type DecisionRecord } from "@app/contracts";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../../errors.ts";
import type { AuthenticatedPrincipal } from "../../http/platform-auth.ts";
import { logger } from "../../logger.ts";
import type { ReviewsRepository } from "./reviews.repository.ts";
import { decisionLedgerFilename, toDecisionLedgerCsv } from "./decision-ledger-csv.ts";

type Input = { assessmentRunId: string; analystIdentityId: AnalystIdentityId; authenticatedProfileId: AnalystIdentityId; analystId: string; analystName: string; analystRole: "relationship_manager" | "credit_analyst" | "senior_credit_officer" | "credit_committee"; expectedSequence: 1 | 2; decision: "approve" | "refer" | "decline" | "override"; notes: string; overrideOutcome?: "Approve" | "Refer" | "Decline"; overrideReason?: DecisionRecord["overrideReason"] };

/** Roles that work the review queue and may take the full decision ledger with them. */
export const DECISION_LEDGER_ROLES: readonly AuthenticatedPrincipal["role"][] = ["credit_analyst", "senior_credit_officer", "credit_committee"];

export class ReviewsService {
  private readonly repository: ReviewsRepository;
  constructor(repository: ReviewsRepository) { this.repository = repository; }
  list() { return this.repository.list(); }

  /** The full decision ledger as a downloadable CSV, named for the day the committee takes it away. */
  async exportDecisionLedger(principal: AuthenticatedPrincipal, now: Date = new Date()): Promise<{ filename: string; csv: string }> {
    if (!DECISION_LEDGER_ROLES.includes(principal.role)) {
      throw new AuthorizationError("Your authenticated role cannot export the full decision ledger.");
    }
    const rows = await this.repository.listDecisionLedger();
    const filename = decisionLedgerFilename(now);
    const csv = toDecisionLedgerCsv(rows);
    logger.info("decision ledger exported", { userId: principal.sub, principalId: principal.sub, profileId: principal.profileId, role: principal.role, rows: rows.length, filename });
    return { filename, csv };
  }

  async decide(applicationId: string, input: Input): Promise<DecisionRecord> {
    const item = await this.repository.findAwaitingDecision(applicationId);
    if (!item) throw new NotFoundError("The application is not awaiting an analyst decision.");
    if (item.sampleData) throw new ConflictError("This recommendation comes from sample or legacy simulated data and cannot be recorded as a final credit decision. Run a live assessment before deciding this application.");
    if (input.analystIdentityId !== input.authenticatedProfileId) throw new AuthorizationError("Record the decision as your authenticated platform identity.");
    this.requireAuthority(item.authority, input.analystRole);
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

  private requireAuthority(authority: unknown, role: Input["analystRole"]): void {
    const parsedAuthority = decisionAuthoritySchema.safeParse(authority);
    if (!parsedAuthority.success) throw new AuthorizationError("The assessment has an unrecognised decision authority and must be escalated.");
    const allowedByAuthority: Record<DecisionAuthority, Input["analystRole"][]> = {
      "Credit analyst confirms": ["credit_analyst", "senior_credit_officer", "credit_committee"],
      "Senior credit officer": ["senior_credit_officer", "credit_committee"],
      "Credit analyst reviews the flagged checks": ["credit_analyst", "senior_credit_officer", "credit_committee"],
      "Credit analyst, then a second analyst (four eyes)": ["credit_analyst", "senior_credit_officer", "credit_committee"],
      "Credit committee": ["credit_committee"],
    };
    const allowed = allowedByAuthority[parsedAuthority.data];
    if (!allowed.includes(role)) throw new AuthorizationError(`Your authenticated role cannot exercise the required authority: ${authority}.`);
  }
}
