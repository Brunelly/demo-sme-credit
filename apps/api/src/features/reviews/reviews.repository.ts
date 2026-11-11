import type { CreditApplication, CreditRecommendation, DecisionRecord, ReviewQueueItem } from "@app/contracts";
import type { Db, IndexDescription } from "mongodb";
import { MongoServerError } from "mongodb";
import { ConflictError } from "../../errors.ts";

export const DECISIONS_COLLECTION = "creditDecisions";
export const decisionIndexes: IndexDescription[] = [
  { key: { applicationId: 1, recordedAt: 1, _id: 1 }, name: "decisions_application_history" },
  { key: { status: 1, recordedAt: -1, _id: -1 }, name: "decisions_weekly_throughput" },
  { key: { applicationId: 1, ledgerSlot: 1 }, name: "decisions_one_per_sequence", unique: true, partialFilterExpression: { ledgerSlot: { $exists: true } } },
];
interface DecisionDocument extends Omit<DecisionRecord, "id"> { _id: string; ledgerSlot?: number }
interface ApplicationDocument extends Omit<CreditApplication, "id" | "receivedAt"> { _id: string; receivedAt: Date; sampleData: boolean }
interface RunDocument { _id: string; applicationId: string; status: string; startedAt?: string; finalRecommendation?: CreditRecommendation; recommendation?: CreditRecommendation }

export class ReviewsRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async list(): Promise<{ items: ReviewQueueItem[]; sampleData: boolean }> {
    const applications = await this.db.collection<ApplicationDocument>("applications").find({ stage: { $in: ["decision_required", "referred"] } }).sort({ receivedAt: 1, _id: 1 }).limit(50).toArray();
    const items: ReviewQueueItem[] = [];
    for (const row of applications) {
      const run = await this.db.collection<RunDocument>("applicationCheckRuns").find({ applicationId: row._id, $or: [{ status: "completed" }, { recommendation: { $exists: true } }] }).sort({ startedAt: -1, performedAt: -1, _id: -1 } as never).limit(1).next();
      const recommendation = run?.finalRecommendation ?? run?.recommendation;
      if (!recommendation) continue;
      const decisions = await this.listDecisions(row._id);
      const pending = decisions.at(-1)?.status === "awaiting_second_analyst";
      if (decisions.some((decision) => decision.status === "final") && !pending) continue;
      const { _id, receivedAt, sampleData: _sampleData, ...application } = row;
      items.push({ application: { id: _id, receivedAt: receivedAt.toISOString(), ...application }, recommendation, authority: recommendation.decisionAuthority, authorityClause: "SME-CP-07 §7.1", decisions, queueStatus: pending ? "awaiting_second_analyst" : "awaiting_decision" });
    }
    return { items, sampleData: applications.length > 0 && applications.every((item) => item.sampleData) };
  }

  async listDecisions(applicationId: string): Promise<DecisionRecord[]> {
    const rows = await this.db.collection<DecisionDocument>(DECISIONS_COLLECTION).find({ applicationId }).sort({ recordedAt: 1, _id: 1 }).limit(20).toArray();
    return rows.map(({ _id, ledgerSlot: _ledgerSlot, ...row }) => ({ id: _id, ...row }));
  }

  async insert(decision: DecisionRecord): Promise<void> {
    const { id, ...document } = decision;
    try {
      await this.db.collection<DecisionDocument>(DECISIONS_COLLECTION).insertOne({ _id: id, ...document, ledgerSlot: decision.sequence });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ConflictError("Another analyst recorded this decision first. Refresh the review queue before continuing.");
      }
      throw error;
    }
  }
}
