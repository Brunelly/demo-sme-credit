import request from "supertest";
import { describe, expect, it } from "vitest";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

describe("applications queue", () => {
  it("returns at most 50 applications with the oldest first", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertMany([
      { _id: "newer", businessName: "Newer", businessNameArabic: "الأحدث", commercialRegistration: "1010000002", product: "working_capital", amountSar: 500000, stage: "new", receivedAt: new Date("2026-11-10T00:00:00Z"), city: "Riyadh", sampleData: true },
      { _id: "older", businessName: "Older", businessNameArabic: "الأقدم", commercialRegistration: "1010000001", product: "invoice_financing", amountSar: 900000, stage: "decision_required", receivedAt: new Date("2026-11-01T00:00:00Z"), city: "Riyadh", sampleData: true },
    ]);

    const response = await request(testApp(mongo.db)).get("/api/applications").expect(200);

    expect(response.body.sampleData).toBe(true);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(["older", "newer"]);
    expect(response.body.items[0]).toMatchObject({ amountSar: 900000, stage: "decision_required" });
  });

  it("runs and records all four policy specialists", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "case-1", businessName: "Sample Food Distributor", businessNameArabic: "موزع أغذية تجريبي", commercialRegistration: "1010000099", product: "invoice_financing", amountSar: 1000000, stage: "credit_assessment", receivedAt: new Date(), city: "Riyadh", sampleData: true, invoice: { number: "INV-99", buyerName: "Sample Public Buyer", buyerCategory: "Government", amountSar: 1200000 } });

    const response = await request(testApp(mongo.db, { config: { simulatedDataScenario: "disputed_invoice" } })).post("/api/applications/case-1/checks").send({}).expect(201);

    expect(response.body.scenario).toBe("disputed_invoice");
    expect(response.body.results).toHaveLength(4);
    expect(response.body.results.map((result: { clause: string }) => result.clause)).toEqual(["SME-CP-07 §3.1", "SME-CP-07 §3.2", "SME-CP-07 §3.3", "SME-CP-07 §3.4"]);
    expect(response.body.results.find((result: { specialist: string }) => result.specialist.startsWith("ZATCA"))).toMatchObject({ outcome: "refer" });
    expect(response.body.recommendation).toMatchObject({ outcome: "Refer", authorityClause: "SME-CP-07 §7.1" });
    expect(response.body.recommendation.reasons).toContainEqual(expect.objectContaining({ clause: "SME-CP-07 §§4.1, 4.5", evidence: expect.stringContaining("INV-99") }));
    expect(response.body.recommendation.reviewerChallenges).toContainEqual(expect.objectContaining({ specialist: "ZATCA e-invoice verification", status: "challenge" }));
    expect((await request(testApp(mongo.db)).get("/api/applications/case-1/checks").expect(200)).body.latest.id).toBe(response.body.id);
  });

  it("changes an outcome when the configured scenario changes", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "case-2", businessName: "Sample Logistics", businessNameArabic: "لوجستيات تجريبية", commercialRegistration: "4030000099", product: "working_capital", amountSar: 1000000, stage: "new", receivedAt: new Date(), city: "Jeddah", sampleData: true });
    const clean = await request(testApp(mongo.db, { config: { simulatedDataScenario: "clean" } })).post("/api/applications/case-2/checks").send({}).expect(201);
    const changed = await request(testApp(mongo.db, { config: { simulatedDataScenario: "low_bureau" } })).post("/api/applications/case-2/checks").send({}).expect(201);
    expect(clean.body.results[0].outcome).toBe("pass");
    expect(changed.body.results[0].outcome).toBe("refer");
  });

  it("changes the recommendation by selected scenario and records an Appendix A override", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "case-3", businessName: "Sample Packaging", businessNameArabic: "تعبئة تجريبية", commercialRegistration: "1010000088", product: "working_capital", amountSar: 1000000, stage: "decision_required", receivedAt: new Date(), city: "Riyadh", sampleData: true, annualRevenueSar: 12000000, riskGrade: "B" });
    const app = testApp(mongo.db);
    const clean = await request(app).post("/api/applications/case-3/checks").send({ scenario: "clean" }).expect(201);
    const declined = await request(app).post("/api/applications/case-3/checks").send({ scenario: "ineligible_revenue" }).expect(201);
    expect(clean.body.recommendation.outcome).toBe("Approve");
    expect(declined.body.recommendation.outcome).toBe("Decline");

    const overridden = await request(app).post(`/api/applications/case-3/checks/${declined.body.id}/override`).send({ outcome: "Refer", reason: "Data quality issue in a source check", rationale: "Financial statements are being corrected by the applicant." }).expect(201);
    expect(overridden.body.recommendation.override).toMatchObject({ outcome: "Refer", reason: "Data quality issue in a source check", recordedBy: "Credit analyst" });
    expect((await request(app).get("/api/applications/case-3/checks").expect(200)).body.latest.recommendation.override.outcome).toBe("Refer");
  });
});
