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
    expect(response.body.items[0]).toMatchObject({ application: { id: "app-1" }, queueStatus: "awaiting_decision", authorityClause: "SME-CP-07 §7.1" });
  });

  it("requires a distinct second analyst before a decline is final and records both reasons", async () => {
    await seed(); const app = testApp(mongo.db);
    const first = await request(app).post("/api/reviews/app-1/decisions").send({ analystName: "Analyst A", decision: "decline", notes: "Bureau evidence does not meet policy." }).expect(201);
    expect(first.body).toMatchObject({ status: "awaiting_second_analyst", sequence: 1, analystName: "Analyst A" });
    await request(app).post("/api/reviews/app-1/decisions").send({ analystName: "analyst a", decision: "decline", notes: "I confirm the evidence review." }).expect(409);
    const second = await request(app).post("/api/reviews/app-1/decisions").send({ analystName: "Analyst B", decision: "decline", notes: "Independent review confirms the decline." }).expect(201);
    expect(second.body).toMatchObject({ status: "final", sequence: 2, analystName: "Analyst B" });
    expect(await mongo.db.collection("creditDecisions").countDocuments({ applicationId: "app-1" })).toBe(2);
  });

  it("records an override only with an Appendix A reason", async () => {
    await seed(); const app = testApp(mongo.db);
    await request(app).post("/api/reviews/app-1/decisions").send({ analystName: "Analyst A", decision: "override", overrideOutcome: "Approve", notes: "New signed buyer confirmation is now available." }).expect(400);
    const response = await request(app).post("/api/reviews/app-1/decisions").send({ analystName: "Analyst A", decision: "override", overrideOutcome: "Approve", overrideReason: "Information not available to the assessment", notes: "New signed buyer confirmation is now available." }).expect(201);
    expect(response.body).toMatchObject({ decision: "override", effectiveOutcome: "Approve", overrideReason: "Information not available to the assessment", analystName: "Analyst A" });
  });

  it("requires Appendix A override evidence when the analyst departs from the recommendation", async () => {
    await seed();
    const response = await request(testApp(mongo.db)).post("/api/reviews/app-1/decisions").send({ analystName: "Analyst A", decision: "approve", notes: "I would approve this application." }).expect(400);
    expect(response.body.error.message).toContain("must be recorded as an override");
  });
});
