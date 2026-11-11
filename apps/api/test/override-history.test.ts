import request from "supertest";
import { describe, expect, it } from "vitest";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

describe("recommendation override history", () => {
  it("appends repeated overrides without changing the prior audit record", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "app-override", businessName: "Sample applicant", businessNameArabic: "طلب تجريبي", commercialRegistration: "1010000001", product: "working_capital", amountSar: 1_000_000, stage: "decision_required", receivedAt: new Date(), city: "Riyadh", sampleData: true });
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertOne({ _id: "run-override", applicationId: "app-override", status: "completed", finalRecommendation: { outcome: "Refer", reasons: [] } });
    const app = testApp(mongo.db);

    await request(app).post("/api/applications/app-override/checks/run-override/override").send({ outcome: "Approve", reason: "Relationship history with the Bank", rationale: "Documented repayment history supports approval." }).expect(201);
    const decline = await request(app).post("/api/applications/app-override/checks/run-override/override").send({ outcome: "Decline", reason: "Sector or market conditions", rationale: "Updated market evidence supports decline." }).expect(400);
    expect(decline.body.error.message).toContain("decision ledger and four-eyes control");

    const stored = await mongo.db.collection("applicationCheckRuns").findOne({ _id: "run-override" } as never);
    expect(stored?.finalRecommendation.overrides).toMatchObject([
      { outcome: "Approve", reason: "Relationship history with the Bank", rationale: "Documented repayment history supports approval.", recordedBy: "Credit analyst" },
    ]);
  });
});
