import { z } from "zod";
import type { CreditApplication, CreditRecommendation, DecisionAuthority, OverrideReason, RecommendationOutcome } from "./applications.ts";

export const analystDecisionSchema = z.enum(["approve", "refer", "decline", "override"]);
export type AnalystDecision = z.infer<typeof analystDecisionSchema>;
export const analystIdentities = [
  { id: "maha-alotaibi", name: "Maha Alotaibi", role: "Credit analyst" },
  { id: "faisal-alqahtani", name: "Faisal Alqahtani", role: "Credit analyst" },
  { id: "noura-alharbi", name: "Noura Alharbi", role: "Senior credit officer" },
] as const;
export const analystIdentityIdSchema = z.enum(["maha-alotaibi", "faisal-alqahtani", "noura-alharbi"]);
export type AnalystIdentityId = z.infer<typeof analystIdentityIdSchema>;
export const recordDecisionSchema = z.object({
  assessmentRunId: z.string().trim().min(1),
  analystIdentityId: analystIdentityIdSchema,
  expectedSequence: z.union([z.literal(1), z.literal(2)]),
  decision: analystDecisionSchema,
  notes: z.string().trim().min(5).max(1000),
  overrideOutcome: z.enum(["Approve", "Refer", "Decline"]).optional(),
  overrideReason: z.enum(["Additional collateral or guarantee provided", "Information not available to the assessment", "Relationship history with the Bank", "Data quality issue in a source check", "Sector or market conditions"]).optional(),
}).superRefine((value, context) => {
  if (value.decision === "override" && (!value.overrideOutcome || !value.overrideReason)) {
    context.addIssue({ code: "custom", path: ["overrideReason"], message: "Choose an override outcome and Appendix A reason." });
  }
});

export interface DecisionRecord {
  id: string; applicationId: string; assessmentRunId: string; analystId: string; analystName: string; decision: AnalystDecision;
  effectiveOutcome: RecommendationOutcome; notes: string; overrideReason?: OverrideReason;
  recordedAt: string; status: "recorded" | "awaiting_second_analyst" | "final";
  sequence: 1 | 2;
}
export interface ReviewQueueItem {
  application: CreditApplication; assessmentRunId: string; recommendation: CreditRecommendation; authority: DecisionAuthority;
  authorityClause: "SME-CP-07 §7.1"; decisions: DecisionRecord[]; queueStatus: "awaiting_decision" | "awaiting_second_analyst";
}
export interface ReviewQueueResponse { items: ReviewQueueItem[]; sampleData: boolean }
