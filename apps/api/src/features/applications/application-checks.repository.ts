import type { ApplicationCheckRun, AssessmentStep, CreditRecommendation, RecommendationOverride, ReviewerChallenge, SpecialistFinding, SpecialistType } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";
export const APPLICATION_CHECK_RUNS_COLLECTION = "applicationCheckRuns";
interface RunDocument extends Omit<ApplicationCheckRun, "id"> { _id: string }
interface LegacyRunDocument {
  _id: string; applicationId: string; scenario: ApplicationCheckRun["scenarioId"]; performedAt: Date;
  results: { specialist: SpecialistType; clause: string; outcome: "pass" | "refer"; summary: string; evidence: string[] }[];
  recommendation: { outcome: "Approve" | "Refer" | "Decline"; riskGrade: "A" | "B" | "C" | "D"; indicativeProfitRate: string; decisionAuthority: string; authorityClause: "SME-CP-07 §7.1"; reasons: { clause: string; conclusion: string; evidence: string }[]; reviewerChallenges: { specialist: SpecialistType; status: "confirmed" | "challenge"; conclusion: string; evidenceGap?: string }[] };
}
export const applicationCheckRunIndexes: IndexDescription[] = [
  { key: { applicationId: 1, startedAt: -1, _id: -1 }, name: "application_assessment_runs_history" },
];
export class ApplicationChecksRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }
  async record(run: ApplicationCheckRun): Promise<ApplicationCheckRun> {
    const { id, ...rest } = run; await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).insertOne({ _id: id, ...rest }); return run;
  }
  async updateStep(runId: string, held: { "lease.owner": string }, key: string, status: AssessmentStep["status"], at: string, runIdFromMaitento?: string): Promise<boolean> {
    const set: Record<string, unknown> = { "steps.$.status": status };
    if (status === "running") set["steps.$.startedAt"] = at;
    if (status === "completed" || status === "failed") set["steps.$.completedAt"] = at;
    const update: Record<string, unknown> = { $set: set };
    if (runIdFromMaitento) update.$push = { "steps.$.maitentoRunIds": runIdFromMaitento };
    return (await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).updateOne({ _id: runId, ...held, "steps.key": key }, update)).matchedCount === 1;
  }
  async addFinding(runId: string, held: { "lease.owner": string }, finding: SpecialistFinding): Promise<boolean> {
    return (await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).updateOne({ _id: runId, ...held }, { $push: { specialistFindings: finding } })).matchedCount === 1;
  }
  async addReview(runId: string, held: { "lease.owner": string }, review: ReviewerChallenge): Promise<boolean> {
    return (await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).updateOne({ _id: runId, ...held }, { $push: { reviewerChallenges: review } })).matchedCount === 1;
  }
  async addRevision(runId: string, held: { "lease.owner": string }, finding: SpecialistFinding): Promise<boolean> {
    return (await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).updateOne({ _id: runId, ...held }, { $push: { revisedFindings: finding } })).matchedCount === 1;
  }
  async complete(runId: string, held: { "lease.owner": string }, recommendation: CreditRecommendation, at: string): Promise<boolean> {
    return (await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).updateOne({ _id: runId, ...held }, { $set: { status: "completed", finalRecommendation: recommendation, completedAt: at }, $unset: { lease: "" } })).matchedCount === 1;
  }
  async fail(runId: string, held: { "lease.owner": string }, reason: string, at: string): Promise<void> {
    await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).updateOne({ _id: runId, ...held }, { $set: { status: "failed", failureReason: reason, completedAt: at, "steps.$[active].status": "failed", "steps.$[active].completedAt": at }, $unset: { lease: "" } }, { arrayFilters: [{ "active.status": "running" }] });
  }
  async list(applicationId: string): Promise<ApplicationCheckRun[]> {
    const rows = await this.db.collection<RunDocument | LegacyRunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).find({ applicationId }).sort({ startedAt: -1, _id: -1 }).limit(50).toArray();
    return rows.map((row) => this.toContract(row));
  }
  async find(applicationId: string, runId: string): Promise<ApplicationCheckRun | null> {
    const row = await this.db.collection<RunDocument | LegacyRunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).findOne({ _id: runId, applicationId });
    return row ? this.toContract(row) : null;
  }
  async findById(runId: string): Promise<ApplicationCheckRun | null> {
    const row = await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).findOne({ _id: runId });
    if (!row) return null; const { _id, ...rest } = row; return { id: _id, ...rest };
  }
  async latest(applicationId: string): Promise<ApplicationCheckRun | null> { return (await this.list(applicationId))[0] ?? null; }
  async recordOverride(applicationId: string, runId: string, override: RecommendationOverride): Promise<ApplicationCheckRun | null> {
    const row = await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).findOneAndUpdate(
      { _id: runId, applicationId, status: "completed" }, { $set: { "finalRecommendation.override": override } }, { returnDocument: "after" });
    if (!row) return null; const { _id, ...rest } = row; return { id: _id, ...rest };
  }
  private toContract(row: RunDocument | LegacyRunDocument): ApplicationCheckRun {
    if ("specialistFindings" in row) { const { _id, ...rest } = row; return { id: _id, ...rest }; }
    const at = row.performedAt.toISOString();
    const findings = row.results.map((result, index) => ({ id: `${row._id}-finding-${index + 1}`, specialistType: result.specialist, round: 1 as const, outcome: result.outcome, plainLanguageFinding: result.summary, sourceLabel: `Legacy simulated ${result.specialist} source`, evidence: result.evidence.map((fact, evidenceIndex) => ({ fact, sourceReference: `Legacy record · item ${evidenceIndex + 1}` })), policyCitations: [result.clause], createdAt: at, revisionSummary: null }));
    const reviews = row.recommendation.reviewerChallenges.map((review, index) => ({ id: `${row._id}-review-${index + 1}`, findingId: findings.find((finding) => finding.specialistType === review.specialist)!.id, specialistType: review.specialist, status: review.status === "confirmed" ? "accepted" as const : "challenge" as const, conclusion: review.conclusion, evidenceGap: review.evidenceGap ?? null, reasoningDefect: null, policyCitation: null, createdAt: at }));
    return { id: row._id, applicationId: row.applicationId, scenarioId: row.scenario, scenarioVersion: 0, status: "completed", startedAt: at, completedAt: at, specialistFindings: findings, reviewerChallenges: reviews, revisedFindings: [], finalRecommendation: { ...row.recommendation, reasons: row.recommendation.reasons.map((reason) => ({ ...reason, findingIds: findings.map((finding) => finding.id) })), notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: at, override: undefined }, failureReason: null, createdBy: "Credit analyst" };
  }
}
