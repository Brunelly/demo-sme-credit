import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildSpecialistPromptPayload, validateRecommendationCitations } from "../src/features/applications/applications.service.ts";
import { testApp, useTestDatabase } from "./helpers.ts";
const mongo = useTestDatabase();
const caseRecord = { _id: "case-1", businessName: "Sample Food Distributor", businessNameArabic: "موزع أغذية تجريبي", commercialRegistration: "1010000099", product: "invoice_financing", amountSar: 1000000, stage: "credit_assessment", receivedAt: new Date(), city: "Riyadh", sampleData: true, annualRevenueSar: 12000000, invoice: { number: "INV-99", buyerName: "Sample Public Buyer", buyerCategory: "Government", amountSar: 1200000 } };
describe("traceable application assessments", () => {
  it("constructs a source-scoped prompt payload", () => {
    const payload = buildSpecialistPromptPayload({ ...caseRecord, id: "case-1", receivedAt: new Date().toISOString(), product: "invoice_financing", stage: "credit_assessment" }, "clean", "SIMAH credit bureau");
    expect(JSON.parse(payload.sourceData)).toEqual(expect.objectContaining({ assignedSource: "SIMAH credit bureau", simulated: true }));
    expect(payload.sourceData).not.toContain("ZATCA");
  });
  it("runs four findings, routes only challenged work to one rework pass, and persists history", async () => {
    await mongo.db.collection("applications").insertOne(caseRecord); const app = testApp(mongo.db);
    await request(app).put("/api/settings/simulated-scenario").send({ activeScenarioId: "disputed_invoice" }).expect(200);
    const first = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    expect(first.body).toMatchObject({ status: "completed", scenarioId: "disputed_invoice", scenarioVersion: 1 });
    expect(first.body.specialistFindings).toHaveLength(4);
    expect(first.body.reviewerChallenges.filter((r: { status: string }) => r.status === "challenge")).toHaveLength(1);
    expect(first.body.revisedFindings).toHaveLength(1);
    expect(first.body.revisedFindings[0]).toMatchObject({ specialistType: "ZATCA e-invoice verification", round: 2, outcome: "refer" });
    expect(first.body.finalRecommendation).toMatchObject({ outcome: "Refer", authorityClause: "SME-CP-07 §7.1" });
    expect(validateRecommendationCitations(first.body.finalRecommendation)).toBe(true);
    await request(app).put("/api/settings/simulated-scenario").send({ activeScenarioId: "clean" }).expect(200);
    await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    const history = await request(app).get("/api/applications/case-1/assessment-runs").expect(200);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.items.map((r: { scenarioId: string }) => r.scenarioId)).toEqual(["clean", "disputed_invoice"]);
    expect((await request(app).get(`/api/applications/case-1/assessment-runs/${first.body.id}`).expect(200)).body.id).toBe(first.body.id);
  });
  it("changes scenarios only through settings and records an override on the selected immutable run", async () => {
    await mongo.db.collection("applications").insertOne(caseRecord); const app = testApp(mongo.db);
    await request(app).post("/api/applications/case-1/assessment-runs").send({ scenario: "low_bureau" }).expect(202);
    let history = await request(app).get("/api/applications/case-1/assessment-runs").expect(200);
    expect(history.body.items[0].scenarioId).toBe("clean");
    await request(app).put("/api/settings/simulated-scenario").send({ activeScenarioId: "low_bureau" }).expect(200);
    const run = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    expect(run.body.finalRecommendation.outcome).toBe("Refer");
    const overridden = await request(app).post(`/api/applications/case-1/checks/${run.body.id}/override`).send({ outcome: "Approve", reason: "Information not available to the assessment", rationale: "Signed buyer confirmation was independently received." }).expect(201);
    expect(overridden.body.finalRecommendation.override).toMatchObject({ outcome: "Approve", recordedBy: "Credit analyst" });
    history = await request(app).get("/api/applications/case-1/assessment-runs").expect(200);
    expect(history.body.items[1].finalRecommendation.override).toBeUndefined();
  });
  it("rejects recommendation reasons outside the permitted decision clauses", () => {
    expect(validateRecommendationCitations({ outcome: "Approve", riskGrade: null, indicativeProfitRate: null, decisionAuthority: "Analyst", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §3.1", conclusion: "Unsupported", evidence: "x", findingIds: ["f-1"] }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: new Date().toISOString() })).toBe(false);
  });
});
