import { randomUUID } from "node:crypto";
import type { ApplicationCheckRun, AssessmentStep, CreditRecommendation, OverrideReason, RecommendationOutcome, ReviewerChallenge, SimulatedScenario, SpecialistFinding, SpecialistType } from "@app/contracts";
import { z } from "zod";
import { AI_NOT_CONNECTED, type AiRunner } from "../../ai/maitento.ts";
import type { LongRunningWork } from "../../db/long-running.ts";
import { AiFailedError, ConflictError, DependencyUnavailableError, NotFoundError, ValidationError } from "../../errors.ts";
import type { ApplicationChecksRepository } from "./application-checks.repository.ts";
import type { ApplicationsRepository } from "./applications.repository.ts";
import type { SimulatedSourcesRepository } from "./simulated-sources.repository.ts";

const SPECIALISTS: { type: SpecialistType; interaction: string }[] = [
  { type: "SIMAH credit bureau", interaction: "check-simah-credit" },
  { type: "Wathq company verification", interaction: "check-wathq-company" },
  { type: "ZATCA e-invoice verification", interaction: "check-zatca-invoice" },
  { type: "Open banking cash flow", interaction: "check-open-banking" },
];
const REWORK: Record<SpecialistType, string> = { "SIMAH credit bureau": "rework-simah-credit", "Wathq company verification": "rework-wathq-company", "ZATCA e-invoice verification": "rework-zatca-invoice", "Open banking cash flow": "rework-open-banking" };
const findingResultSchema = z.object({ outcome: z.enum(["pass", "refer", "human_review"]), plainLanguageFinding: z.string().min(1), sourceLabel: z.string().min(1), evidence: z.array(z.object({ fact: z.string().min(1), sourceReference: z.string().min(1) })).min(1), policyCitations: z.array(z.string().min(1)).min(1), revisionSummary: z.string().nullable() });
const reviewResultSchema = z.object({ status: z.enum(["accepted", "challenge", "human_review"]), conclusion: z.string().min(1), evidenceGap: z.string().nullable(), reasoningDefect: z.string().nullable(), policyCitation: z.string().nullable() });
const recommendationResultSchema = z.object({ outcome: z.enum(["Approve", "Refer", "Decline"]), riskGrade: z.enum(["A", "B", "C", "D"]).nullable(), indicativeProfitRate: z.string().nullable(), missingGradeInputs: z.array(z.enum(["commercial_credit_report", "owner_credit_reports", "debt_service_coverage", "buyer_quality"])), decisionAuthority: z.string().min(1), authorityClause: z.literal("SME-CP-07 §7.1"), reasons: z.array(z.object({ clause: z.string(), conclusion: z.string(), evidence: z.string(), findingIds: z.array(z.string()).min(1) })).min(1), notice: z.literal("AI recommendation — a human must make the decision under SME-CP-07 §7.1.") }).superRefine((recommendation, context) => {
  if (recommendation.riskGrade === null && recommendation.missingGradeInputs.length === 0) context.addIssue({ code: "custom", path: ["missingGradeInputs"], message: "An ungraded recommendation must identify its missing grade inputs." });
  if (recommendation.riskGrade !== null && recommendation.missingGradeInputs.length > 0) context.addIssue({ code: "custom", path: ["missingGradeInputs"], message: "A graded recommendation cannot have missing grade inputs." });
  if (recommendation.riskGrade === null && recommendation.indicativeProfitRate !== null) context.addIssue({ code: "custom", path: ["indicativeProfitRate"], message: "Pricing requires a risk grade." });
});
const ALLOWED_RECOMMENDATION_CITATION = /^SME-CP-07 §(?:4\.[1-5]|5\.[1-4]|6)$/;
const FINAL_POLICY_CLAUSES = {
  "§4 Invoice financing": ["§4.1 Invoices must be due within 120 days, undisputed, and for delivered goods or services.", "§4.2 Advance rates are up to 85% for Government, 80% for Listed or rated corporate, and 70% for Established private buyers; Other buyers are referred.", "§4.3 A single buyer cannot exceed 40% of the facility.", "§4.4 Related-party invoices are ineligible.", "§4.5 A duplicate or mismatched invoice makes the application Refer; suspected fraud is escalated to Financial Crime."],
  "§5 Working capital": ["§5.1 The limit is the lower of 25% of annual revenue and three months of average monthly inflow.", "§5.2 DSCR must be at least 1.25× after existing obligations.", "§5.3 More than three returned cheques or payment reversals in 12 months is a Refer.", "§5.4 Maximum tenor is 12 months and renewal needs a fresh assessment."],
  "§6 Risk grade and pricing": ["Grade A: Bureau Low, DSCR above 1.75×, strong buyers; SAIBOR + 2.25%.", "Grade B: Bureau Low or Moderate, DSCR 1.4–1.75×; SAIBOR + 3.0%.", "Grade C: Bureau Moderate, DSCR 1.25–1.4×; SAIBOR + 4.0%.", "Grade D: Elevated risk or any policy exception; Credit committee only."],
};

export function validateRecommendationCitations(recommendation: CreditRecommendation): boolean { return recommendation.reasons.length > 0 && recommendation.reasons.every((reason) => ALLOWED_RECOMMENDATION_CITATION.test(reason.clause) && reason.findingIds.length > 0); }
export function validateRecommendationAgainstFindings(recommendation: CreditRecommendation, findings: SpecialistFinding[]): boolean {
  const flagged = findings.filter((finding) => finding.outcome !== "pass");
  if (flagged.length === 0) return true;
  if (recommendation.outcome === "Approve") return false;
  return flagged.every((finding) => recommendation.reasons.some((reason) => reason.findingIds.includes(finding.id)));
}
export function buildSpecialistPromptPayload(source: unknown, specialistOrScenario: SpecialistType | string, legacySpecialist?: SpecialistType): Record<string, string> { const specialist = legacySpecialist ?? specialistOrScenario as SpecialistType; return { sourceData: JSON.stringify({ assignedSource: specialist, simulated: true, source }) }; }
function parseAi<T>(schema: z.ZodType<T>, output: string, label: string): T { try { return schema.parse(JSON.parse(output)); } catch (cause) { throw new AiFailedError(`${label} returned an answer that could not be verified.`, { cause }); } }
function workflowSteps(): AssessmentStep[] { return [...SPECIALISTS.map(({ type }) => ({ key: type, label: type, status: "queued" as const, startedAt: null, completedAt: null, maitentoRunIds: [], failureReason: null })), { key: "reviewer", label: "Independent reviewer", status: "queued", startedAt: null, completedAt: null, maitentoRunIds: [], failureReason: null }, { key: "final", label: "Final recommendation assistant", status: "queued", startedAt: null, completedAt: null, maitentoRunIds: [], failureReason: null }]; }
function safeStageFailure(error: unknown): string { return error instanceof AiFailedError || error instanceof ValidationError || error instanceof ConflictError ? error.message : "Maitento could not complete this stage. Start a new assessment to try again."; }

export class ApplicationsService {
  private readonly repository: ApplicationsRepository; private readonly checks: ApplicationChecksRepository; private readonly scenario: SimulatedScenario; private readonly sources: SimulatedSourcesRepository; private readonly ai: AiRunner | null; private readonly longRunning: LongRunningWork;
  constructor(repository: ApplicationsRepository, checks: ApplicationChecksRepository, scenario: SimulatedScenario, sources: SimulatedSourcesRepository, ai: AiRunner | null, longRunning: LongRunningWork) { this.repository = repository; this.checks = checks; this.scenario = scenario; this.sources = sources; this.ai = ai; this.longRunning = longRunning; }
  list() { return this.repository.list(); }
  async latestChecks(applicationId: string) { await this.requireApplication(applicationId); return { latest: await this.checks.latest(applicationId), simulatedData: true as const }; }
  async listRuns(applicationId: string) { await this.requireApplication(applicationId); return { items: await this.checks.list(applicationId), simulatedData: true as const }; }
  async getRun(applicationId: string, runId: string) { await this.requireApplication(applicationId); const run = await this.checks.find(applicationId, runId); if (!run) throw new NotFoundError("The assessment run was not found."); return run; }
  async runChecks(applicationId: string): Promise<ApplicationCheckRun> {
    if (!this.ai) throw new DependencyUnavailableError(AI_NOT_CONNECTED);
    await this.requireApplication(applicationId);
    if (!await this.sources.get(applicationId, this.scenario)) throw new ValidationError("No simulated source pack is available for this application and scenario.");
    const now = new Date().toISOString();
    const run = { id: randomUUID(), applicationId, scenarioId: this.scenario, status: "running", startedAt: now, completedAt: null, specialistFindings: [], reviewerChallenges: [], revisedFindings: [], finalRecommendation: null, failureReason: null, createdBy: "Credit analyst", steps: workflowSteps(), ...this.longRunning.lease() } as ApplicationCheckRun;
    await this.checks.record(run); void this.process(run.id); return run;
  }
  async process(runId: string): Promise<void> {
    const held = this.longRunning.held();
    let activeStep: AssessmentStep = workflowSteps()[0]!;
    try {
      const run = await this.checks.findById(runId); if (!run || run.status !== "running") return;
      const application = await this.requireApplication(run.applicationId); const pack = await this.sources.get(run.applicationId, run.scenarioId);
      if (!pack || !this.ai) throw new AiFailedError("The assessment source pack or Maitento connection is unavailable.");
      const findings: SpecialistFinding[] = [];
      for (const specialist of SPECIALISTS) {
        activeStep = { ...activeStep, key: specialist.type, label: specialist.type };
        await this.requireHeld(await this.checks.updateStep(runId, held, specialist.type, "running", new Date().toISOString()));
        const result = await this.ai.runInteraction(specialist.interaction, buildSpecialistPromptPayload(pack.sources[specialist.type], specialist.type));
        const finding: SpecialistFinding = { id: randomUUID(), specialistType: specialist.type, round: 1, ...parseAi(findingResultSchema, result.output, specialist.type), createdAt: new Date().toISOString(), maitentoRunId: result.runId };
        await this.requireHeld(await this.checks.addFinding(runId, held, finding)); findings.push(finding);
        await this.requireHeld(await this.checks.updateStep(runId, held, specialist.type, "completed", finding.createdAt, result.runId));
      }
      activeStep = { ...activeStep, key: "reviewer", label: "Independent reviewer" };
      await this.requireHeld(await this.checks.updateStep(runId, held, "reviewer", "running", new Date().toISOString()));
      const reviews: ReviewerChallenge[] = [];
      for (const finding of findings) {
        const result = await this.ai.runInteraction("review-specialist-finding", { finding: JSON.stringify({ finding, assignedSource: pack.sources[finding.specialistType], simulated: true }) });
        const review: ReviewerChallenge = { id: randomUUID(), findingId: finding.id, specialistType: finding.specialistType, ...parseAi(reviewResultSchema, result.output, "The independent reviewer"), createdAt: new Date().toISOString(), maitentoRunId: result.runId };
        await this.requireHeld(await this.checks.addReview(runId, held, review)); reviews.push(review);
        await this.requireHeld(await this.checks.updateStep(runId, held, "reviewer", "running", review.createdAt, result.runId));
      }
      await this.requireHeld(await this.checks.updateStep(runId, held, "reviewer", "completed", new Date().toISOString()));
      const revised: SpecialistFinding[] = [];
      for (const review of reviews.filter((item) => item.status === "challenge")) {
        const original = findings.find((item) => item.id === review.findingId)!;
        const result = await this.ai.runInteraction(REWORK[original.specialistType], { challenge: JSON.stringify(review), findingAndSource: JSON.stringify({ finding: original, assignedSource: pack.sources[original.specialistType], simulated: true }) });
        const revision: SpecialistFinding = { id: randomUUID(), specialistType: original.specialistType, round: 2, ...parseAi(findingResultSchema, result.output, `${original.specialistType} re-pass`), createdAt: new Date().toISOString(), maitentoRunId: result.runId };
        await this.requireHeld(await this.checks.addRevision(runId, held, revision)); revised.push(revision);
      }
      activeStep = { ...activeStep, key: "final", label: "Final recommendation assistant" };
      await this.requireHeld(await this.checks.updateStep(runId, held, "final", "running", new Date().toISOString()));
      const corrected = findings.map((finding) => revised.find((item) => item.specialistType === finding.specialistType) ?? finding);
      const finalRun = await this.ai.runInteraction("prepare-final-recommendation", { correctedFindings: JSON.stringify({ application: { id: application.id, product: application.product, amountSar: application.amountSar }, findings: corrected }), policyClauses: JSON.stringify(FINAL_POLICY_CLAUSES) });
      const recommendation: CreditRecommendation = { ...parseAi(recommendationResultSchema, finalRun.output, "The final recommendation assistant"), createdAt: new Date().toISOString() };
      const validIds = new Set(corrected.map((item) => item.id));
      if (!validateRecommendationCitations(recommendation) || recommendation.reasons.some((reason) => reason.findingIds.some((id) => !validIds.has(id))) || !validateRecommendationAgainstFindings(recommendation, corrected)) throw new ValidationError("The AI recommendation did not contain valid policy and evidence citations.");
      await this.requireHeld(await this.checks.updateStep(runId, held, "final", "completed", recommendation.createdAt, finalRun.runId));
      await this.requireHeld(await this.checks.complete(runId, held, recommendation, recommendation.createdAt));
    } catch (error) {
      const at = new Date().toISOString();
      const reason = `${activeStep.label} failed: ${safeStageFailure(error)}`;
      if (error instanceof ConflictError) {
        await this.checks.interruptAfterLeaseLoss(runId, held, "Assessment ownership changed before this stage could be saved. Start a new assessment.", at);
      } else {
        await this.checks.fail(runId, held, activeStep.key, reason, at);
      }
    }
  }
  async recordOverride(applicationId: string, runId: string, input: { outcome: RecommendationOutcome; reason: OverrideReason; rationale: string }) { await this.requireApplication(applicationId); const updated = await this.checks.recordOverride(applicationId, runId, { ...input, recordedAt: new Date().toISOString(), recordedBy: "Credit analyst" }); if (!updated) throw new NotFoundError("The completed assessment run was not found."); return updated; }
  private async requireApplication(id: string) { const item = await this.repository.find(id); if (!item) throw new NotFoundError("The financing application was not found."); return item; }
  private async requireHeld(value: boolean) { if (!value) throw new ConflictError("This assessment is no longer held by the current process."); }
}
