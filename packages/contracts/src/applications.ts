import { z } from "zod";

export const applicationProductSchema = z.enum(["invoice_financing", "working_capital"]);
export const applicationStageSchema = z.enum(["new", "eligibility_review", "credit_assessment", "decision_required", "referred"]);
export type ApplicationProduct = z.infer<typeof applicationProductSchema>;
export type ApplicationStage = z.infer<typeof applicationStageSchema>;
export interface CreditApplication {
  id: string; businessName: string; businessNameArabic: string; commercialRegistration: string;
  product: ApplicationProduct; amountSar: number; stage: ApplicationStage; receivedAt: string; city: string;
  riskGrade?: "A" | "B" | "C" | "D"; annualRevenueSar?: number;
  invoice?: { number: string; buyerName: string; buyerCategory: "Government" | "Listed" | "Established private" | "Other"; amountSar: number };
}
export interface ListApplicationsResponse { items: CreditApplication[]; sampleData: boolean }
export const simulatedScenarioSchema = z.enum(["clean", "disputed_invoice", "low_bureau", "returned_cheques"]);
export type SimulatedScenario = z.infer<typeof simulatedScenarioSchema>;
export const recommendationOutcomeSchema = z.enum(["Approve", "Refer", "Decline"]);
export const decisionAuthoritySchema = z.enum(["Credit analyst confirms", "Senior credit officer", "Credit analyst reviews the flagged checks", "Credit analyst, then a second analyst (four eyes)", "Credit committee"]);
export const overrideReasonSchema = z.enum(["Additional collateral or guarantee provided", "Information not available to the assessment", "Relationship history with the Bank", "Data quality issue in a source check", "Sector or market conditions"]);
export type RecommendationOutcome = z.infer<typeof recommendationOutcomeSchema>;
export type DecisionAuthority = z.infer<typeof decisionAuthoritySchema>;
export type OverrideReason = z.infer<typeof overrideReasonSchema>;
export type SpecialistType = "SIMAH credit bureau" | "Wathq company verification" | "ZATCA e-invoice verification" | "Open banking cash flow";
export interface FindingEvidence { fact: string; sourceReference: string }
export interface SpecialistFinding {
  id: string; specialistType: SpecialistType; round: 1 | 2; outcome: "pass" | "refer" | "human_review";
  plainLanguageFinding: string; sourceLabel: string; evidence: FindingEvidence[]; policyCitations: string[];
  createdAt: string; revisionSummary: string | null; maitentoRunId?: string;
}
export interface ReviewerChallenge {
  id: string; findingId: string; specialistType: SpecialistType; status: "accepted" | "challenge" | "human_review";
  conclusion: string; evidenceGap: string | null; reasoningDefect: string | null; policyCitation: string | null; createdAt: string; maitentoRunId?: string;
}
export interface RecommendationReason { clause: string; conclusion: string; evidence: string; findingIds: string[] }
export type MissingGradeInput = "commercial_credit_report" | "owner_credit_reports" | "debt_service_coverage" | "buyer_quality";
export interface RecommendationOverride { outcome: RecommendationOutcome; reason: OverrideReason; rationale: string; recordedAt: string; recordedBy: "Credit analyst" }
export interface CreditRecommendation {
  outcome: RecommendationOutcome; riskGrade: "A" | "B" | "C" | "D" | null; indicativeProfitRate: string | null;
  /** Inputs the policy needs before assigning a grade. Empty when a grade is assigned; optional on historical records. */
  missingGradeInputs?: MissingGradeInput[];
  decisionAuthority: DecisionAuthority; authorityClause: "SME-CP-07 §7.1"; reasons: RecommendationReason[];
  notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1."; createdAt: string;
  /** Chronological, append-only analyst override audit trail. */
  overrides?: RecommendationOverride[];
  /** Latest override retained for compatibility with assessment records created before the audit trail. */
  override?: RecommendationOverride;
}
export type AssessmentStatus = "running" | "completed" | "failed" | "interrupted";
export interface AssessmentStep {
  key: string; label: string; status: "queued" | "running" | "completed" | "failed";
  startedAt: string | null; completedAt: string | null; maitentoRunIds: string[];
  failureReason?: string | null;
}
export interface ApplicationCheckRun {
  id: string; applicationId: string; scenarioId: SimulatedScenario; status: AssessmentStatus;
  startedAt: string; completedAt: string | null; specialistFindings: SpecialistFinding[]; reviewerChallenges: ReviewerChallenge[];
  revisedFindings: SpecialistFinding[]; finalRecommendation: CreditRecommendation | null; failureReason: string | null;
  interruptedReason?: string; createdBy: "Credit analyst";
  /** True on a trail seeded as sample data; absent on an assessment a person actually ran. */
  sampleData?: boolean;
  steps?: AssessmentStep[];
}
export interface AssessmentRunsResponse { items: ApplicationCheckRun[]; simulatedData: true }
export interface ApplicationChecksResponse { latest: ApplicationCheckRun | null; simulatedData: true }
