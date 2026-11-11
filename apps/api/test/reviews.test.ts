import request from "supertest";
import { describe, expect, it } from "vitest";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();
async function seed() {
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "app-1", businessName: "Sample Trading", businessNameArabic: "شركة تجريبية", commercialRegistration: "1010000001", product: "working_capital", amountSar: 1800000, stage: "decision_required", receivedAt: new Date("2026-11-10T08:00:00Z"), city: "Riyadh", riskGrade: "B", sampleData: true });
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertOne({ _id: "run-1", applicationId: "app-1", status: "completed", startedAt: "2026-11-10T09:00:00Z", finalRecommendation: { outcome: "Decline", riskGrade: "B", indicativeProfitRate: null, decisionAuthority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1", reasons: [], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: "2026-11-10T09:00:00Z" } });
}

describe("review queue", () => {
  it("lists cases awaiting a decision with policy authority", async () => {
    await seed();
    const response = await request(testApp(mongo.db)).get("/api/reviews").expect(200);
    expect(response.body.items[0]).toMatchObject({ application: { id: "app-1" }, assessmentRunId: "run-1", queueStatus: "awaiting_decision", authorityClause: "SME-CP-07 §7.1" });
  });

  it("decides a queued application beyond the first 50 rows", async () => {
    const applications = Array.from({ length: 51 }, (_, index) => ({
      _id: `queued-${String(index).padStart(2, "0")}`,
      businessName: `Sample applicant ${index}`,
      businessNameArabic: "طلب تجريبي",
      commercialRegistration: `1010000${String(index).padStart(3, "0")}`,
      product: "working_capital",
      amountSar: 1_000_000,
      stage: "decision_required",
      receivedAt: new Date(`2026-11-09T${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00Z`),
      city: "Riyadh",
      sampleData: true,
    }));
    const runs = applications.map((application) => ({ _id: `run-${application._id}`, applicationId: application._id, status: "completed", startedAt: "2026-11-10T09:00:00Z", finalRecommendation: { outcome: "Approve", decisionAuthority: "Credit analyst confirms" } }));
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertMany(applications);
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertMany(runs);

    const response = await request(testApp(mongo.db)).post("/api/reviews/queued-50/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-queued-50", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "approve", notes: "All required evidence supports approval." }).expect(201);

    expect(response.body).toMatchObject({ applicationId: "queued-50", assessmentRunId: "run-queued-50", status: "final" });
  });

  it("requires a distinct second analyst before a decline is final and records both reasons", async () => {
    await seed(); const app = testApp(mongo.db);
    const first = await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "decline", notes: "Bureau evidence does not meet policy." }).expect(201);
    expect(first.body).toMatchObject({ status: "awaiting_second_analyst", sequence: 1, analystId: "platform-user-17", analystName: "Maha Alotaibi" });
    await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "faisal-alqahtani", expectedSequence: 2, decision: "decline", notes: "I confirm the evidence review." }).expect(409);
    const second = await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-29").send({ assessmentRunId: "run-1", analystIdentityId: "faisal-alqahtani", expectedSequence: 2, decision: "decline", notes: "Independent review confirms the decline." }).expect(201);
    expect(second.body).toMatchObject({ status: "final", sequence: 2, analystId: "platform-user-29", analystName: "Faisal Alqahtani" });
    expect(await mongo.db.collection("creditDecisions").countDocuments({ applicationId: "app-1" })).toBe(2);
  });

  it("records an override only with an Appendix A reason", async () => {
    await seed(); const app = testApp(mongo.db);
    await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "override", overrideOutcome: "Approve", notes: "New signed buyer confirmation is now available." }).expect(400);
    const response = await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "override", overrideOutcome: "Approve", overrideReason: "Information not available to the assessment", notes: "New signed buyer confirmation is now available." }).expect(201);
    expect(response.body).toMatchObject({ decision: "override", effectiveOutcome: "Approve", overrideReason: "Information not available to the assessment", analystName: "Maha Alotaibi" });
  });

  it("requires Appendix A override evidence when the analyst departs from the recommendation", async () => {
    await seed();
    const response = await request(testApp(mongo.db)).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "approve", notes: "I would approve this application." }).expect(400);
    expect(response.body.error.message).toContain("must be recorded as an override");
  });

  it("allows a second analyst to confirm or reject an override-to-decline without changing the recommendation", async () => {
    await seed();
    const runs = mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns");
    await runs.updateOne({ _id: "run-1" }, { $set: { "finalRecommendation.outcome": "Approve" } });
    const original = await runs.findOne({ _id: "run-1" });
    const app = testApp(mongo.db);
    await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "override", overrideOutcome: "Decline", overrideReason: "Sector or market conditions", notes: "Current sector conditions warrant decline." }).expect(201);
    const rejected = await request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-29").send({ assessmentRunId: "run-1", analystIdentityId: "faisal-alqahtani", expectedSequence: 2, decision: "approve", notes: "Independent review retains the original recommendation." }).expect(201);
    expect(rejected.body).toMatchObject({ sequence: 2, status: "final", effectiveOutcome: "Approve" });
    expect(await runs.findOne({ _id: "run-1" })).toEqual(original);
    expect(await mongo.db.collection("creditDecisions").countDocuments({ applicationId: "app-1" })).toBe(2);
  });

  it("atomically accepts only one concurrent decision for each ledger sequence", async () => {
    await seed(); const app = testApp(mongo.db);
    const results = await Promise.all(["platform-user-17", "platform-user-29"].map((analystId, index) => request(app).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", analystId).send({ assessmentRunId: "run-1", analystIdentityId: index === 0 ? "maha-alotaibi" : "faisal-alqahtani", expectedSequence: 1, decision: "decline", notes: "Bureau evidence does not meet policy." })));
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await mongo.db.collection("creditDecisions").countDocuments({ applicationId: "app-1", sequence: 1 })).toBe(1);
  });

  it("rejects an identity outside the fixed PoC list", async () => {
    await seed();
    await request(testApp(mongo.db)).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "unlisted-person", expectedSequence: 1, decision: "decline", notes: "Bureau evidence does not meet policy." }).expect(400);
  });

  it("rejects a stale decision after a newer assessment completes", async () => {
    await seed();
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertOne({ _id: "run-2", applicationId: "app-1", status: "completed", startedAt: "2026-11-11T09:00:00Z", finalRecommendation: { outcome: "Approve", riskGrade: "A", indicativeProfitRate: null, decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1", reasons: [], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: "2026-11-11T09:00:00Z" } });
    const response = await request(testApp(mongo.db)).post("/api/reviews/app-1/decisions").set("x-authenticated-user-id", "platform-user-17").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "decline", notes: "Decision against the earlier assessment." }).expect(409);
    expect(response.body.error.message).toContain("different assessment");
    expect(await mongo.db.collection("creditDecisions").countDocuments()).toBe(0);
  });

  it("requires the authenticated platform identity for every ledger decision", async () => {
    await seed();
    await request(testApp(mongo.db)).post("/api/reviews/app-1/decisions").send({ assessmentRunId: "run-1", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "decline", notes: "Bureau evidence does not meet policy." }).expect(401);
    expect(await mongo.db.collection("creditDecisions").countDocuments()).toBe(0);
  });

  it("uses the latest permitted workbench override as the queue's effective outcome", async () => {
    await seed();
    await mongo.db.collection("applicationCheckRuns").updateOne({ _id: "run-1" } as never, { $set: { "finalRecommendation.override": { outcome: "Approve", reason: "Relationship history with the Bank", rationale: "Documented repayment history supports approval.", recordedAt: "2026-11-11T09:00:00Z", recordedBy: "Credit analyst" } } } as never);
    const response = await request(testApp(mongo.db)).get("/api/reviews").expect(200);
    expect(response.body.items[0].recommendation.outcome).toBe("Approve");
  });
});
