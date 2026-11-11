import type { ApplicationCheckRun, SpecialistCheckResult } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";

export const APPLICATION_CHECK_RUNS_COLLECTION = "applicationCheckRuns";
interface CheckRunDocument extends Omit<ApplicationCheckRun, "id" | "performedAt"> { _id: string; performedAt: Date }

export const applicationCheckRunIndexes: IndexDescription[] = [
  { key: { applicationId: 1, performedAt: -1, _id: -1 }, name: "application_check_runs_latest" },
];

export class ApplicationChecksRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async record(run: Omit<ApplicationCheckRun, "performedAt"> & { performedAt: Date }): Promise<ApplicationCheckRun> {
    const { id, ...values } = run;
    const document: CheckRunDocument = { ...values, _id: id };
    await this.db.collection<CheckRunDocument>(APPLICATION_CHECK_RUNS_COLLECTION).insertOne(document);
    return this.toContract(document);
  }

  async latest(applicationId: string): Promise<ApplicationCheckRun | null> {
    const document = await this.db.collection<CheckRunDocument>(APPLICATION_CHECK_RUNS_COLLECTION)
      .find({ applicationId }).sort({ performedAt: -1, _id: -1 }).limit(1).next();
    return document ? this.toContract(document) : null;
  }

  private toContract(document: CheckRunDocument): ApplicationCheckRun {
    return { id: document._id, applicationId: document.applicationId, scenario: document.scenario, performedAt: document.performedAt.toISOString(), results: document.results as SpecialistCheckResult[] };
  }
}
