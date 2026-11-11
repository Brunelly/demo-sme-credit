import type { Db } from "mongodb";

const recommendation = {
  _id: "sample-assessment-app-1029-throughput",
  applicationId: "app-1029",
  status: "completed",
  startedAt: "2026-11-10T11:00:00.000Z",
  finalRecommendation: {
    outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", decisionAuthority: "Senior credit officer",
    authorityClause: "SME-CP-07 §7.1", reasons: [], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: "2026-11-10T14:00:00.000Z",
  },
  sampleData: true,
} as const;

const decisions = [
  { _id: "sample-decision-app-1025", applicationId: "app-1025", analystId: "noura-alharbi", analystName: "Noura Alharbi", decision: "approve", effectiveOutcome: "Approve", notes: "Sample decision based on the recorded assessment evidence.", recordedAt: "2026-11-10T09:30:00.000Z", status: "final", sequence: 1, ledgerSlot: 1 },
  { _id: "sample-decision-app-1007-1", applicationId: "app-1007", analystId: "maha-alotaibi", analystName: "Maha Alotaibi", decision: "decline", effectiveOutcome: "Decline", notes: "Sample first-analyst decision based on the bureau evidence.", recordedAt: "2026-11-10T12:20:00.000Z", status: "awaiting_second_analyst", sequence: 1, ledgerSlot: 1 },
  { _id: "sample-decision-app-1007-2", applicationId: "app-1007", analystId: "faisal-alqahtani", analystName: "Faisal Alqahtani", decision: "decline", effectiveOutcome: "Decline", notes: "Sample independent confirmation under the four-eyes rule.", recordedAt: "2026-11-11T08:10:00.000Z", status: "final", sequence: 2, ledgerSlot: 2 },
  { _id: "sample-decision-app-1029", applicationId: "app-1029", analystId: "noura-alharbi", analystName: "Noura Alharbi", decision: "override", effectiveOutcome: "Refer", overrideReason: "Information not available to the assessment", notes: "Sample override pending review of additional buyer confirmation.", recordedAt: "2026-11-11T10:40:00.000Z", status: "final", sequence: 1, ledgerSlot: 1 },
] as const;

export async function up(db: Db): Promise<void> {
  await db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").updateOne({ _id: recommendation._id }, { $setOnInsert: recommendation }, { upsert: true });
  for (const decision of decisions) {
    await db.collection<{ _id: string; [key: string]: unknown }>("creditDecisions").updateOne({ _id: decision._id }, { $setOnInsert: decision }, { upsert: true });
  }
}
