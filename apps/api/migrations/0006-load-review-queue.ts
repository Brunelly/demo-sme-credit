import type { Db } from "mongodb";

const declineRun = {
  _id: "sample-assessment-app-1007-review",
  applicationId: "app-1007",
  scenario: "low_bureau",
  performedAt: new Date("2026-11-11T08:40:00Z"),
  results: [{ specialist: "SIMAH credit bureau", clause: "SME-CP-07 §3.1", outcome: "refer", summary: "Credit bureau evidence requires a human decline decision.", evidence: ["Commercial bureau result reviewed", "Qualifying owners checked"] }],
  recommendation: {
    outcome: "Decline", riskGrade: "D", indicativeProfitRate: "Credit committee only", decisionAuthority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1",
    reasons: [{ clause: "SME-CP-07 §6", conclusion: "The policy exception supports a decline recommendation.", evidence: "The reviewed bureau finding records elevated risk." }],
    reviewerChallenges: [{ specialist: "SIMAH credit bureau", status: "confirmed", conclusion: "The evidence supports escalation to human decision." }],
  },
  sampleData: true,
} as const;

export async function up(db: Db): Promise<void> {
  await db.collection<{ _id: string; [key: string]: unknown }>("applications").updateOne({ _id: "app-1025" }, { $set: { stage: "decision_required" } });
  await db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").updateOne({ _id: declineRun._id }, { $setOnInsert: declineRun }, { upsert: true });
}
