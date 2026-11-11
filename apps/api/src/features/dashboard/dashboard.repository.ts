import type { RecentThroughputDecision, RecommendationOutcome } from "@app/contracts";
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
export interface WeeklyDecisionSummary {
  decisionsCompleted: number;
  averageTurnaroundHours: number | null;
  approvals: number;
  referrals: number;
  declines: number;
  overrideCount: number;
  recentDecisions: RecentThroughputDecision[];
}

export class DashboardRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async countApplications(start: Date, end: Date): Promise<number> {
    return this.db.collection<ApplicationDocument>("applications").countDocuments({ receivedAt: { $gte: start, $lt: end } });
  }

  async summarizeFinalDecisions(start: Date, end: Date): Promise<WeeklyDecisionSummary> {
    type AggregationResult = { metrics: Omit<WeeklyDecisionSummary, "recentDecisions">[]; recentDecisions: RecentThroughputDecision[] };
    const [result] = await this.db.collection<DecisionDocument>("creditDecisions").aggregate<AggregationResult>([
      { $match: { status: "final", recordedAt: { $gte: start.toISOString(), $lt: end.toISOString() } } },
      { $lookup: { from: "applications", localField: "applicationId", foreignField: "_id", as: "application" } },
      { $unwind: "$application" },
      { $lookup: {
        from: "applicationCheckRuns",
        let: { applicationId: "$applicationId", assessmentRunId: "$assessmentRunId" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$applicationId", "$$applicationId"] },
            { $cond: [
              { $ne: [{ $ifNull: ["$$assessmentRunId", null] }, null] },
              { $eq: ["$_id", "$$assessmentRunId"] },
              { $or: [{ $eq: ["$status", "completed"] }, { $ne: [{ $type: "$recommendation" }, "missing"] }] },
            ] },
          ] } } },
          { $sort: { startedAt: -1, performedAt: -1, _id: -1 } },
          { $limit: 1 },
        ],
        as: "run",
      } },
      { $set: {
        run: { $first: "$run" },
        decidedAt: { $convert: { input: "$recordedAt", to: "date", onError: null, onNull: null } },
      } },
      { $set: {
        recommendation: { $ifNull: ["$run.finalRecommendation", "$run.recommendation"] },
        turnaroundHours: { $max: [0, { $divide: [{ $subtract: ["$decidedAt", "$application.receivedAt"] }, 3_600_000] }] },
      } },
      { $set: {
        recommendationOutcome: { $ifNull: [
          { $arrayElemAt: ["$recommendation.overrides.outcome", -1] },
          { $ifNull: ["$recommendation.override.outcome", "$recommendation.outcome"] },
        ] },
      } },
      { $set: { overridden: { $and: [
        { $ne: [{ $ifNull: ["$recommendationOutcome", null] }, null] },
        { $ne: ["$recommendationOutcome", "$effectiveOutcome"] },
      ] } } },
      { $sort: { recordedAt: -1, _id: -1 } },
      { $facet: {
        metrics: [{ $group: {
          _id: null,
          decisionsCompleted: { $sum: 1 },
          averageTurnaroundHours: { $avg: "$turnaroundHours" },
          approvals: { $sum: { $cond: [{ $eq: ["$effectiveOutcome", "Approve"] }, 1, 0] } },
          referrals: { $sum: { $cond: [{ $eq: ["$effectiveOutcome", "Refer"] }, 1, 0] } },
          declines: { $sum: { $cond: [{ $eq: ["$effectiveOutcome", "Decline"] }, 1, 0] } },
          overrideCount: { $sum: { $cond: ["$overridden", 1, 0] } },
        } }, { $project: { _id: 0 } }],
        recentDecisions: [
          { $limit: 8 },
          { $project: { _id: 0, id: "$_id", applicationId: 1, businessName: "$application.businessName", product: "$application.product", amountSar: "$application.amountSar", outcome: "$effectiveOutcome", receivedAt: { $dateToString: { date: "$application.receivedAt" } }, decidedAt: { $dateToString: { date: "$decidedAt" } }, turnaroundHours: 1, overridden: 1 } },
        ],
      } },
    ]).toArray();
    return {
      decisionsCompleted: result?.metrics[0]?.decisionsCompleted ?? 0,
      averageTurnaroundHours: result?.metrics[0]?.averageTurnaroundHours ?? null,
      approvals: result?.metrics[0]?.approvals ?? 0,
      referrals: result?.metrics[0]?.referrals ?? 0,
      declines: result?.metrics[0]?.declines ?? 0,
      overrideCount: result?.metrics[0]?.overrideCount ?? 0,
      recentDecisions: result?.recentDecisions ?? [],
    };
  }

  async isSampleData(): Promise<boolean> {
    const [anyApplication, realApplication] = await Promise.all([
      this.db.collection<ApplicationDocument>("applications").findOne({}),
      this.db.collection<ApplicationDocument>("applications").findOne({ sampleData: { $ne: true } }),
    ]);
    return Boolean(anyApplication && !realApplication);
  }
}
