import type { CreditRecommendation, RecentThroughputDecision, RecommendationOutcome } from "@app/contracts";
import type { Db } from "mongodb";

interface ApplicationDocument {
  _id: string;
  businessName: string;
  product: "invoice_financing" | "working_capital";
  amountSar: number;
  receivedAt: Date;
  sampleData?: boolean;
}
interface DecisionDocument {
  _id: string;
  applicationId: string;
  assessmentRunId?: string;
  effectiveOutcome: RecommendationOutcome;
  recordedAt: string;
  status: string;
}
interface RunDocument {
  _id: string;
  applicationId: string;
  status: string;
  startedAt?: string;
  performedAt?: Date;
  finalRecommendation?: CreditRecommendation;
  recommendation?: CreditRecommendation;
}

export class DashboardRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async countApplications(start: Date, end: Date): Promise<number> {
    return this.db.collection<ApplicationDocument>("applications").countDocuments({ receivedAt: { $gte: start, $lt: end } });
  }

  async listFinalDecisions(start: Date, end: Date): Promise<RecentThroughputDecision[]> {
    const rows = await this.db.collection<DecisionDocument>("creditDecisions")
      .find({ status: "final", recordedAt: { $gte: start.toISOString(), $lt: end.toISOString() } })
      .sort({ recordedAt: -1, _id: -1 }).limit(50).toArray();
    const results: RecentThroughputDecision[] = [];
    for (const decision of rows) {
      const application = await this.db.collection<ApplicationDocument>("applications").findOne({ _id: decision.applicationId });
      if (!application) continue;
      const runs = this.db.collection<RunDocument>("applicationCheckRuns");
      const run = decision.assessmentRunId
        ? await runs.findOne({ _id: decision.assessmentRunId, applicationId: decision.applicationId })
        : await runs.find({ applicationId: decision.applicationId, $or: [{ status: "completed" }, { recommendation: { $exists: true } }] }).sort({ startedAt: -1, performedAt: -1, _id: -1 } as never).limit(1).next();
      const recommendation = run?.finalRecommendation ?? run?.recommendation;
      const decidedAt = new Date(decision.recordedAt);
      results.push({
        id: decision._id,
        applicationId: decision.applicationId,
        businessName: application.businessName,
        product: application.product,
        amountSar: application.amountSar,
        outcome: decision.effectiveOutcome,
        receivedAt: application.receivedAt.toISOString(),
        decidedAt: decidedAt.toISOString(),
        turnaroundHours: Math.max(0, (decidedAt.getTime() - application.receivedAt.getTime()) / 3_600_000),
        overridden: Boolean(recommendation && recommendation.outcome !== decision.effectiveOutcome),
      });
    }
    return results;
  }

  async isSampleData(): Promise<boolean> {
    const [anyApplication, realApplication] = await Promise.all([
      this.db.collection<ApplicationDocument>("applications").findOne({}),
      this.db.collection<ApplicationDocument>("applications").findOne({ sampleData: { $ne: true } }),
    ]);
    return Boolean(anyApplication && !realApplication);
  }
}
