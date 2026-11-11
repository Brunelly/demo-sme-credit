import { z } from "zod";

export const applicationProductSchema = z.enum(["invoice_financing", "working_capital"]);
export const applicationStageSchema = z.enum(["new", "eligibility_review", "credit_assessment", "decision_required", "referred"]);

export type ApplicationProduct = z.infer<typeof applicationProductSchema>;
export type ApplicationStage = z.infer<typeof applicationStageSchema>;

export interface CreditApplication {
  id: string;
  businessName: string;
  businessNameArabic: string;
  commercialRegistration: string;
  product: ApplicationProduct;
  amountSar: number;
  stage: ApplicationStage;
  receivedAt: string;
  city: string;
  riskGrade?: "A" | "B" | "C" | "D";
  annualRevenueSar?: number;
  invoice?: { number: string; buyerName: string; buyerCategory: "Government" | "Listed" | "Established private" | "Other"; amountSar: number };
}

export interface ListApplicationsResponse {
  items: CreditApplication[];
  sampleData: boolean;
}

export const simulatedScenarioSchema = z.enum(["clean", "disputed_invoice", "low_bureau", "returned_cheques", "ineligible_revenue"]);
export type SimulatedScenario = z.infer<typeof simulatedScenarioSchema>;
export type SpecialistOutcome = "pass" | "refer";

export const runApplicationChecksSchema = z.object({ scenario: simulatedScenarioSchema.optional() });
export const recommendationOutcomeSchema = z.enum(["Approve", "Refer", "Decline"]);
export const overrideReasonSchema = z.enum([
  "Additional collateral or guarantee provided",
  "Information not available to the assessment",
  "Relationship history with the Bank",
  "Data quality issue in a source check",
  "Sector or market conditions",
]);
export const recordRecommendationOverrideSchema = z.object({
  outcome: recommendationOutcomeSchema,
  reason: overrideReasonSchema,
  rationale: z.string().trim().min(10, "Explain the override in at least 10 characters.").max(1000),
});
export type RecommendationOutcome = z.infer<typeof recommendationOutcomeSchema>;
export type OverrideReason = z.infer<typeof overrideReasonSchema>;

export interface SpecialistCheckResult {
  specialist: "SIMAH credit bureau" | "Wathq company verification" | "ZATCA e-invoice verification" | "Open banking cash flow";
  clause: "SME-CP-07 §3.1" | "SME-CP-07 §3.2" | "SME-CP-07 §3.3" | "SME-CP-07 §3.4";
  outcome: SpecialistOutcome;
  summary: string;
  evidence: string[];
}

export interface ReviewerChallenge {
  specialist: SpecialistCheckResult["specialist"];
  status: "confirmed" | "challenge";
  conclusion: string;
  evidenceGap?: string;
}

export interface RecommendationReason {
  clause: string;
  conclusion: string;
  evidence: string;
}

export interface RecommendationOverride {
  outcome: RecommendationOutcome;
  reason: OverrideReason;
  rationale: string;
  recordedAt: string;
  recordedBy: "Credit analyst";
}

export interface CreditRecommendation {
  outcome: RecommendationOutcome;
  riskGrade: "A" | "B" | "C" | "D";
  indicativeProfitRate: string;
  decisionAuthority: string;
  authorityClause: "SME-CP-07 §7.1";
  reasons: RecommendationReason[];
  reviewerChallenges: ReviewerChallenge[];
  override?: RecommendationOverride;
}

export interface ApplicationCheckRun {
  id: string;
  applicationId: string;
  scenario: SimulatedScenario;
  performedAt: string;
  results: SpecialistCheckResult[];
  recommendation: CreditRecommendation;
}

export interface ApplicationChecksResponse {
  latest: ApplicationCheckRun | null;
  simulatedData: true;
}
