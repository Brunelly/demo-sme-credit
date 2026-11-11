import type { Db } from "mongodb";

const sampleRun = {
  _id: "sample-assessment-app-1025",
  applicationId: "app-1025",
  scenario: "clean",
  performedAt: new Date("2026-11-11T09:15:00Z"),
  results: [
    { specialist: "SIMAH credit bureau", clause: "SME-CP-07 §3.1", outcome: "pass", summary: "Commercial and qualifying owner reports are within policy.", evidence: ["Commercial score 714 · Low risk", "Owner reports checked"] },
    { specialist: "Wathq company verification", clause: "SME-CP-07 §3.2", outcome: "pass", summary: "CR tenure, activity and authorised signatory match the application.", evidence: ["CR active for 38 months", "Registered activity matches finance purpose", "Signatory authorised"] },
    { specialist: "ZATCA e-invoice verification", clause: "SME-CP-07 §3.3", outcome: "pass", summary: "Clearance record matches the submitted invoice.", evidence: ["INV-2026-1842 · cleared", "Government buyer", "Number, VAT, amount and date match"] },
    { specialist: "Open banking cash flow", clause: "SME-CP-07 §3.4", outcome: "pass", summary: "Twelve months of statement activity supports the requested facility.", evidence: ["12 months analysed", "Average monthly inflow SAR 2,480,000", "1 returned cheque · existing obligations included"] },
  ],
  recommendation: {
    outcome: "Approve",
    riskGrade: "B",
    indicativeProfitRate: "SAIBOR + 3.0%",
    decisionAuthority: "Senior credit officer",
    authorityClause: "SME-CP-07 §7.1",
    reasons: [
      { clause: "SME-CP-07 §2.1", conclusion: "Commercial Registration tenure is eligible.", evidence: "Wathq record shows an active CR for 38 months." },
      { clause: "SME-CP-07 §2.2", conclusion: "Annual revenue is within the eligible range.", evidence: "Financial statements show SAR 28,600,000 annual revenue." },
      { clause: "SME-CP-07 §§2.3–2.5", conclusion: "Tax, sanctions and recent-default eligibility checks are clear.", evidence: "ZATCA registration is in good standing; screening returned no sanctions match; SIMAH found no default in 24 months." },
      { clause: "SME-CP-07 §§4.1, 4.4", conclusion: "Invoice is eligible by tenor, dispute and related-party rules.", evidence: "INV-2026-1842 is due in 74 days, undisputed, delivered and not related-party." },
      { clause: "SME-CP-07 §§4.2–4.3", conclusion: "Buyer quality supports an advance rate up to 85%; concentration is within limit.", evidence: "Government buyer; largest-buyer concentration is 36% of the facility." },
      { clause: "SME-CP-07 §6", conclusion: "Risk grade B sets the indicative pricing basis.", evidence: "Low bureau risk and 1.48× DSCR support grade B." },
    ],
    reviewerChallenges: [
      { specialist: "SIMAH credit bureau", status: "confirmed", conclusion: "Reviewer tested the conclusion and found it supported by the cited evidence." },
      { specialist: "Wathq company verification", status: "confirmed", conclusion: "Reviewer tested the conclusion and found it supported by the cited evidence." },
      { specialist: "ZATCA e-invoice verification", status: "confirmed", conclusion: "Reviewer tested the conclusion and found it supported by the cited evidence." },
      { specialist: "Open banking cash flow", status: "confirmed", conclusion: "Reviewer tested the conclusion and found it supported by the cited evidence." },
    ],
  },
  sampleData: true,
} as const;

export async function up(db: Db): Promise<void> {
  await db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").updateOne(
    { _id: sampleRun._id },
    { $setOnInsert: sampleRun },
    { upsert: true },
  );
}
