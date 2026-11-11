import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AiRunner } from "../src/ai/maitento.ts";
import { buildSpecialistPromptPayload, validateRecommendationCitations } from "../src/features/applications/applications.service.ts";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();
const caseRecord = { _id: "case-1", businessName: "Sample Food Distributor", businessNameArabic: "موزع أغذية تجريبي", commercialRegistration: "1010000099", product: "invoice_financing" as const, amountSar: 1000000, stage: "credit_assessment" as const, receivedAt: new Date(), city: "Riyadh", sampleData: true, annualRevenueSar: 12000000, invoice: { number: "INV-99", buyerName: "Sample Public Buyer", buyerCategory: "Government" as const, amountSar: 1200000 } };
const sources = { "SIMAH credit bureau": { score: 714 }, "Wathq company verification": { activeMonths: 38 }, "ZATCA e-invoice verification": { invoiceNumber: "INV-99", buyerDispute: true }, "Open banking cash flow": { statementMonths: 12, dscr: 1.48 } };

function scriptedAi(): AiRunner & { calls: { name: string; inputs: Record<string, string> }[] } {
  const calls: { name: string; inputs: Record<string, string> }[] = [];
  return { namespace: "test", calls, async runInteraction(name, inputs) {
    calls.push({ name, inputs }); const runId = `mt-${calls.length}`;
    if (name.startsWith("check-")) {
      const type = JSON.parse(inputs.sourceData!).assignedSource as string;
      return { runId, output: JSON.stringify({ outcome: type.startsWith("ZATCA") ? "refer" : "pass", plainLanguageFinding: `${type} wording ${calls.length}`, sourceLabel: `Assigned ${type} simulated source`, evidence: [{ fact: `Evidence from ${type}`, sourceReference: "source · field" }], policyCitations: [type.startsWith("SIMAH") ? "SME-CP-07 §3.1" : type.startsWith("Wathq") ? "SME-CP-07 §3.2" : type.startsWith("ZATCA") ? "SME-CP-07 §3.3" : "SME-CP-07 §3.4"], revisionSummary: null }) };
    }
    if (name === "review-specialist-finding") { const finding = JSON.parse(inputs.finding!).finding; const challenge = finding.specialistType.startsWith("ZATCA"); return { runId, output: JSON.stringify({ status: challenge ? "challenge" : "accepted", conclusion: challenge ? "State the dispute consequence." : "Supported by assigned evidence.", evidenceGap: challenge ? "Connect the dispute to referral." : null, reasoningDefect: challenge ? "Policy consequence missing." : null, policyCitation: challenge ? "SME-CP-07 §4.5" : null }) }; }
    if (name.startsWith("rework-")) { return { runId, output: JSON.stringify({ outcome: "refer", plainLanguageFinding: `Revised wording ${calls.length}`, sourceLabel: "Assigned ZATCA simulated source", evidence: [{ fact: "Buyer dispute recorded", sourceReference: "clearance · dispute" }], policyCitations: ["SME-CP-07 §3.3", "SME-CP-07 §4.5"], revisionSummary: "Connected the dispute to the referral rule." }) }; }
    const corrected = JSON.parse(inputs.correctedFindings!).findings as { id: string; specialistType: string }[]; const zatca = corrected.find(item => item.specialistType.startsWith("ZATCA"))!;
    return { runId, output: JSON.stringify({ outcome: "Refer", riskGrade: "C", indicativeProfitRate: "SAIBOR + 4.0%", decisionAuthority: "Credit analyst reviews the flagged checks", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §4.5", conclusion: `Refer wording ${calls.length}`, evidence: "The corrected ZATCA finding records a dispute.", findingIds: [zatca.id] }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." }) };
  } };
}

async function seedSourcePack(scenarioId = "clean") { await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne(caseRecord); await mongo.db.collection<{ _id: string; [key: string]: unknown }>("simulatedAssessmentSources").insertOne({ _id: `case-1:${scenarioId}`, applicationId: "case-1", scenarioId, sampleData: true, sources }); }

describe("traceable Maitento assessments", () => {
  it("passes only one assigned simulated source to a specialist", () => { const payload = buildSpecialistPromptPayload(sources["SIMAH credit bureau"], "SIMAH credit bureau"); expect(JSON.parse(payload.sourceData)).toEqual({ assignedSource: "SIMAH credit bureau", simulated: true, source: { score: 714 } }); expect(payload.sourceData).not.toContain("ZATCA"); });
  it("runs four specialists in order, reviewer, one re-pass, and final assistant while persisting progress", async () => {
    await seedSourcePack(); const ai = scriptedAi(); const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    expect(started.body).toMatchObject({ status: "running" }); expect(started.body.steps).toHaveLength(6);
    await vi.waitFor(() => expect(ai.calls.length).toBe(10));
    const finished = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(finished.body).toMatchObject({ status: "completed", finalRecommendation: { outcome: "Refer" } });
    expect(ai.calls.map(call => call.name)).toEqual(["check-simah-credit", "check-wathq-company", "check-zatca-invoice", "check-open-banking", "review-specialist-finding", "review-specialist-finding", "review-specialist-finding", "review-specialist-finding", "rework-zatca-invoice", "prepare-final-recommendation"]);
    expect(finished.body.specialistFindings).toHaveLength(4); expect(finished.body.revisedFindings).toHaveLength(1); expect(finished.body.steps.every((step: { status: string }) => step.status === "completed")).toBe(true);
    expect(validateRecommendationCitations(finished.body.finalRecommendation)).toBe(true);
  });
  it("does not fabricate a result when Maitento is not connected", async () => { await seedSourcePack(); await request(testApp(mongo.db)).post("/api/applications/case-1/assessment-runs").send({}).expect(503); expect(await mongo.db.collection("applicationCheckRuns").countDocuments()).toBe(0); });
  it("allows wording to come from each Maitento run", async () => { await seedSourcePack(); const ai = scriptedAi(); const app = testApp(mongo.db, { ai }); const first = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202); await vi.waitFor(() => expect(ai.calls.length).toBe(10)); const second = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202); await vi.waitFor(() => expect(ai.calls.length).toBe(20)); const one = await request(app).get(`/api/applications/case-1/assessment-runs/${first.body.id}`); const two = await request(app).get(`/api/applications/case-1/assessment-runs/${second.body.id}`); expect(one.body.specialistFindings[0].plainLanguageFinding).not.toBe(two.body.specialistFindings[0].plainLanguageFinding); });
});
