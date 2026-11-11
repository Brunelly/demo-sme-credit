import type { ApplicationCheckRun, RecommendationOverride } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";
export const APPLICATION_CHECK_RUNS_COLLECTION = "applicationCheckRuns";
interface RunDocument extends Omit<ApplicationCheckRun, "id"> { _id: string }
export const applicationCheckRunIndexes: IndexDescription[] = [
  { key: { applicationId: 1, startedAt: -1, _id: -1 }, name: "application_assessment_runs_history" },
];
export class ApplicationChecksRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }
  async record(run: ApplicationCheckRun): Promise<ApplicationCheckRun> {
    const { id, ...rest } = run; await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).insertOne({ _id: id, ...rest }); return run;
  }
  async list(applicationId: string): Promise<ApplicationCheckRun[]> {
    const rows = await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).find({ applicationId }).sort({ startedAt: -1, _id: -1 }).limit(50).toArray();
    return rows.map(({ _id, ...row }) => ({ id: _id, ...row }));
  }
  async find(applicationId: string, runId: string): Promise<ApplicationCheckRun | null> {
    const row = await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).findOne({ _id: runId, applicationId });
    if (!row) return null; const { _id, ...rest } = row; return { id: _id, ...rest };
  }
  async latest(applicationId: string): Promise<ApplicationCheckRun | null> { return (await this.list(applicationId))[0] ?? null; }
  async recordOverride(applicationId: string, runId: string, override: RecommendationOverride): Promise<ApplicationCheckRun | null> {
    const row = await this.db.collection<RunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).findOneAndUpdate(
      { _id: runId, applicationId, status: "completed" }, { $set: { "finalRecommendation.override": override } }, { returnDocument: "after" });
    if (!row) return null; const { _id, ...rest } = row; return { id: _id, ...rest };
  }
}
