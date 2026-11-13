import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AiRunner } from "../src/ai/maitento.ts";
import { RUN_TIMEOUT_MS } from "../src/ai/maitento.ts";
import { buildSpecialistPromptPayload, policyClausesForProduct, validateRecommendationCitations } from "../src/features/applications/applications.service.ts";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();
const caseRecord = { _id: "case-1", businessName: "Sample Food Distributor", businessNameArabic: "موزع أغذية تجريبي", commercialRegistration: "1010000099", product: "invoice_financing" as const, amountSar: 1000000, stage: "credit_assessment" as const, receivedAt: new Date(), city: "Riyadh", sampleData: true, annualRevenueSar: 12000000, invoice: { number: "INV-99", buyerName: "Sample Public Buyer", buyerCategory: "Government" as const, amountSar: 1200000 } };
const sources = { "SIMAH credit bureau": { score: 714 }, "Wathq company verification": { activeMonths: 38 }, "ZATCA e-invoice verification": { invoiceNumber: "INV-99", buyerDispute: true }, "Open banking cash flow": { statementMonths: 12, dscr: 1.48, annualRevenueSar: 12000000, averageMonthlyInflowSar: 1000000 } };

function scriptedAi(): AiRunner & { calls: { name: string; inputs: Record<string, string> }[] } {
  const calls: { name: string; inputs: Record<string, string> }[] = [];
  return {
    namespace: "test",
    calls,
    async runInteraction(name, inputs) {
      calls.push({ name, inputs });
      const runId = `mt-${calls.length}`;
      if (name.startsWith("check-")) {
        const type = JSON.parse(inputs.sourceData!).assignedSource as string;
        return { runId, output: JSON.stringify({ outcome: type.startsWith("ZATCA") ? "refer" : "pass", plainLanguageFinding: `${type} wording ${calls.length}`, sourceLabel: `Assigned ${type} simulated source`, evidence: [{ fact: `Evidence from ${type}`, sourceReference: "source · field" }], policyCitations: [type.startsWith("SIMAH") ? "SME-CP-07 §3.1" : type.startsWith("Wathq") ? "SME-CP-07 §3.2" : type.startsWith("ZATCA") ? "SME-CP-07 §3.3" : "SME-CP-07 §3.4"], revisionSummary: null }) };
      }
      if (name === "review-specialist-finding") {
        const finding = JSON.parse(inputs.finding!).finding;
        const challenge = finding.specialistType.startsWith("ZATCA");
        return { runId, output: JSON.stringify({ status: challenge ? "challenge" : "accepted", conclusion: challenge ? "State the dispute consequence." : "Supported by assigned evidence.", evidenceGap: challenge ? "Connect the dispute to referral." : null, reasoningDefect: challenge ? "Policy consequence missing." : null, policyCitation: challenge ? "SME-CP-07 §4.5" : null }) };
      }
      if (name.startsWith("rework-")) {
        return { runId, output: JSON.stringify({ outcome: "refer", plainLanguageFinding: `Revised wording ${calls.length}`, sourceLabel: "Assigned ZATCA simulated source", evidence: [{ fact: "Buyer dispute recorded", sourceReference: "clearance · dispute" }], policyCitations: ["SME-CP-07 §3.3", "SME-CP-07 §4.5"], revisionSummary: "Connected the dispute to the referral rule." }) };
      }
      const corrected = JSON.parse(inputs.correctedFindings!).findings as { id: string; specialistType: string }[];
      const zatca = corrected.find((item) => item.specialistType.startsWith("ZATCA"))!;
      return { runId, output: JSON.stringify({ outcome: "Refer", riskGrade: "C", indicativeProfitRate: "SAIBOR + 4.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst reviews the flagged checks", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §4.5", conclusion: `Refer wording ${calls.length}`, evidence: "The corrected ZATCA finding records a dispute.", findingIds: [zatca.id] }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." }) };
    },
  };
}

async function seedSourcePack(scenarioId = "clean") {
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne(caseRecord);
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("simulatedAssessmentSources").insertOne({ _id: `case-1:${scenarioId}`, applicationId: "case-1", scenarioId, sampleData: true, sources });
}

async function seedOverLimitWorkingCapitalPack() {
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ ...caseRecord, _id: "working-case", product: "working_capital", amountSar: 4000000, invoice: undefined });
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("simulatedAssessmentSources").insertOne({ _id: "working-case:clean", applicationId: "working-case", scenarioId: "clean", sampleData: true, sources });
}

describe("traceable Maitento assessments", () => {
  it("allows Maitento interactions to use their declared two-minute maximum", () => {
    expect(RUN_TIMEOUT_MS).toBe(120_000);
  });
  it("passes only one assigned simulated source to a specialist", () => {
    const payload = buildSpecialistPromptPayload(sources["SIMAH credit bureau"], "SIMAH credit bureau");
    expect(JSON.parse(payload.sourceData)).toEqual({ assignedSource: "SIMAH credit bureau", simulated: true, source: { score: 714 } });
    expect(payload.sourceData).not.toContain("ZATCA");
  });
  it("selects only the policy clauses applicable to the product", () => {
    expect(policyClausesForProduct("invoice_financing")).toHaveProperty("§4 Invoice financing");
    expect(policyClausesForProduct("invoice_financing")).not.toHaveProperty("§5 Working capital");
    expect(policyClausesForProduct("working_capital")).toHaveProperty("§5 Working capital");
    expect(policyClausesForProduct("working_capital")).not.toHaveProperty("§4 Invoice financing");
  });
  it("rejects an approved working-capital recommendation above the sourced revenue and inflow limit", async () => {
    await seedOverLimitWorkingCapitalPack();
    const delegate = scriptedAi();
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        if (name === "prepare-final-recommendation") {
          const payload = JSON.parse(inputs.correctedFindings!);
          expect(payload.application).toMatchObject({ product: "working_capital", amountSar: 4000000, annualRevenueSar: 12000000, averageMonthlyInflowSar: 1000000 });
          expect(JSON.parse(inputs.policyClauses!)).toEqual(expect.objectContaining({ "§5 Working capital": expect.any(Array), "§6 Risk grade and pricing": expect.any(Array) }));
          expect(JSON.parse(inputs.policyClauses!)).not.toHaveProperty("§4 Invoice financing");
          const openBanking = payload.findings.find((finding: { specialistType: string }) => finding.specialistType === "Open banking cash flow");
          return { runId: "unsafe-working-final", output: JSON.stringify({ outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §5.1", conclusion: "Approve", evidence: "Revenue and inflow were supplied.", findingIds: [openBanking.id] }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." }) };
        }
        return delegate.runInteraction(name, inputs);
      },
    };
    const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/working-case/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/working-case/assessment-runs/${started.body.id}`)).body.status).toBe("failed"));
    const failed = await request(app).get(`/api/applications/working-case/assessment-runs/${started.body.id}`).expect(200);
    expect(failed.body.finalRecommendation).toBeNull();
    expect(failed.body.failureReason).toContain("valid product policy and evidence citations");
  });
  it("runs four specialists in order, reviewer, one re-pass, and final assistant while persisting progress", async () => {
    await seedSourcePack();
    const ai = scriptedAi();
    const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    expect(started.body).toMatchObject({ status: "running" });
    expect(started.body.steps).toHaveLength(6);
    await vi.waitFor(() => expect(ai.calls.length).toBe(10));
    const finished = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(finished.body).toMatchObject({ status: "completed", finalRecommendation: { outcome: "Refer" } });
    expect(ai.calls.map((call) => call.name)).toEqual(["check-simah-credit", "check-wathq-company", "check-zatca-invoice", "check-open-banking", "review-specialist-finding", "review-specialist-finding", "review-specialist-finding", "review-specialist-finding", "rework-zatca-invoice", "prepare-final-recommendation"]);
    const finalInputs = ai.calls.at(-1)!.inputs;
    expect(JSON.parse(finalInputs.correctedFindings!)).toMatchObject({ application: { annualRevenueSar: 12000000, averageMonthlyInflowSar: 1000000 }, findings: expect.any(Array) });
    expect(JSON.parse(finalInputs.policyClauses!)).toHaveProperty("§4 Invoice financing");
    expect(JSON.parse(finalInputs.policyClauses!)).not.toHaveProperty("§5 Working capital");
    expect(JSON.parse(finalInputs.policyClauses!)).toHaveProperty("§6 Risk grade and pricing");
    expect(finished.body.specialistFindings).toHaveLength(4);
    expect(finished.body.revisedFindings).toHaveLength(1);
    expect(finished.body.steps.every((step: { status: string }) => step.status === "completed")).toBe(true);
    expect(validateRecommendationCitations(finished.body.finalRecommendation, "invoice_financing")).toBe(true);
  });
  it("marks a run interrupted when ownership changes before its recommendation is saved", async () => {
    await seedSourcePack();
    const ai = scriptedAi();
    const baseRunInteraction = ai.runInteraction.bind(ai);
    ai.runInteraction = async (name, inputs) => {
      const result = await baseRunInteraction(name, inputs);
      if (name === "prepare-final-recommendation") {
        await mongo.db.collection("applicationCheckRuns").updateOne(
          { status: "running" },
          { $set: { "lease.owner": "replacement-process" } },
        );
      }
      return result;
    };
    const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`)).body.status).toBe("interrupted"));
    const interrupted = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(interrupted.body).toMatchObject({
      status: "interrupted",
      finalRecommendation: null,
      interruptedReason: "Assessment ownership changed before this stage could be saved. Start a new assessment.",
    });
  });
  it("uses only the control-centre scenario for all four sources and snapshots it on each run", async () => {
    await seedSourcePack("clean");
    const disputedSources = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, { ...source, sourceScenario: "disputed_invoice" }]));
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("simulatedAssessmentSources").insertOne({ _id: "case-1:disputed_invoice", applicationId: "case-1", scenarioId: "disputed_invoice", sampleData: true, sources: disputedSources });
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("simulatedScenarioSettings").insertOne({ _id: "active", activeScenarioId: "clean", version: 99 });

    const cleanAi = scriptedAi();
    const cleanApp = testApp(mongo.db, { ai: cleanAi, config: { simulatedDataScenario: "clean" } });
    const cleanRun = await request(cleanApp).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(() => expect(cleanAi.calls.length).toBe(10));

    const disputedAi = scriptedAi();
    const disputedApp = testApp(mongo.db, { ai: disputedAi, config: { simulatedDataScenario: "disputed_invoice" } });
    const disputedRun = await request(disputedApp).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    expect(disputedRun.body.scenarioId).toBe("disputed_invoice");
    await vi.waitFor(() => expect(disputedAi.calls.length).toBe(10));
    expect(disputedAi.calls.filter((call) => call.name.startsWith("check-")).map((call) => JSON.parse(call.inputs.sourceData!).source.sourceScenario)).toEqual(["disputed_invoice", "disputed_invoice", "disputed_invoice", "disputed_invoice"]);
    expect((await request(disputedApp).get(`/api/applications/case-1/assessment-runs/${cleanRun.body.id}`).expect(200)).body.scenarioId).toBe("clean");
  });
  it("completes a clean case with a verified Approve recommendation", async () => {
    await seedSourcePack();
    const calls: string[] = [];
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        calls.push(name);
        if (name.startsWith("check-")) {
          const type = JSON.parse(inputs.sourceData!).assignedSource as string;
          return { runId: `clean-check-${calls.length}`, output: JSON.stringify({ outcome: "pass", plainLanguageFinding: `${type} passed its assigned check.`, sourceLabel: `Assigned ${type} simulated source`, evidence: [{ fact: `Compliant evidence from ${type}`, sourceReference: "source · verified field" }], policyCitations: ["SME-CP-07 §3.1"], revisionSummary: null }) };
        }
        if (name === "review-specialist-finding") return { runId: `clean-review-${JSON.parse(inputs.finding!).finding.id}`, output: JSON.stringify({ status: "accepted", conclusion: "Supported by assigned evidence.", evidenceGap: null, reasoningDefect: null, policyCitation: null }) };
        if (name === "prepare-final-recommendation") {
          const findings = JSON.parse(inputs.correctedFindings!).findings as { id: string }[];
          return { runId: "clean-final", output: JSON.stringify({ outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §6", conclusion: "Approve because the corrected findings support grade B.", evidence: "The corrected findings record compliant checks and supported cash flow.", findingIds: findings.map(({ id }) => id) }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." }) };
        }
        throw new Error(`Unexpected clean-case interaction: ${name}`);
      },
    };
    const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`)).body.status).toBe("completed"));
    const finished = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(finished.body.finalRecommendation).toMatchObject({ outcome: "Approve", reasons: [{ clause: "SME-CP-07 §6" }] });
    expect(validateRecommendationCitations(finished.body.finalRecommendation, "invoice_financing")).toBe(true);
    expect(calls).toHaveLength(9);
    expect(calls.some((name) => name.startsWith("rework-"))).toBe(false);
  });
  it("honours a reviewer human-review request in the finding and final recommendation", async () => {
    await seedSourcePack();
    const delegate = scriptedAi();
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        if (name === "review-specialist-finding") {
          const finding = JSON.parse(inputs.finding!).finding as { specialistType: string };
          if (finding.specialistType === "Wathq company verification") {
            return { runId: "review-human", output: JSON.stringify({ status: "human_review", conclusion: "The CR evidence is malformed and requires analyst review.", evidenceGap: "A readable CR record is required.", reasoningDefect: null, policyCitation: "SME-CP-07 §3.2" }) };
          }
        }
        if (name === "prepare-final-recommendation") {
          const findings = JSON.parse(inputs.correctedFindings!).findings as { id: string; specialistType: string; outcome: string }[];
          const wathq = findings.find((finding) => finding.specialistType === "Wathq company verification")!;
          const flaggedIds = findings.filter((finding) => finding.outcome !== "pass").map((finding) => finding.id);
          expect(wathq.outcome).toBe("human_review");
          return { runId: "final-human", output: JSON.stringify({ outcome: "Refer", riskGrade: null, indicativeProfitRate: null, missingGradeInputs: ["buyer_quality"], decisionAuthority: "Credit analyst reviews the flagged checks", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §4.5", conclusion: "Refer for analyst review of malformed evidence and the disputed invoice.", evidence: "The reviewer could not verify the CR evidence and the invoice finding requires referral.", findingIds: flaggedIds }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." }) };
        }
        return delegate.runInteraction(name, inputs);
      },
    };
    const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`)).body.status).toBe("completed"));
    const finished = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(finished.body.specialistFindings.find((finding: { specialistType: string }) => finding.specialistType === "Wathq company verification")).toMatchObject({ outcome: "human_review", plainLanguageFinding: "The CR evidence is malformed and requires analyst review." });
    expect(finished.body.reviewerChallenges).toContainEqual(expect.objectContaining({ specialistType: "Wathq company verification", status: "human_review" }));
    expect(finished.body.finalRecommendation.outcome).toBe("Refer");
  });
  it("atomically rejects a second running assessment before another specialist workflow starts", async () => {
    await seedSourcePack();
    let releaseFirst!: () => void;
    const firstInteraction = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const delegate = scriptedAi();
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        if (name === "check-simah-credit") await firstInteraction;
        return delegate.runInteraction(name, inputs);
      },
    };
    const app = testApp(mongo.db, { ai });
    const first = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(409, { error: { code: "conflict", message: "An assessment is already running for this application." } });
    expect(await mongo.db.collection("applicationCheckRuns").countDocuments({ applicationId: "case-1", status: "running" })).toBe(1);
    releaseFirst();
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${first.body.id}`)).body.status).toBe("completed"));
  });
  it("rejects a malformed final recommendation before it is persisted", async () => {
    await seedSourcePack();
    const delegate = scriptedAi();
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        if (name === "prepare-final-recommendation") return { runId: "malformed-final", output: JSON.stringify({ outcome: "Approve", reasons: [] }) };
        return delegate.runInteraction(name, inputs);
      },
    };
    const app = testApp(mongo.db, { ai });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`)).body.status).toBe("failed"));
    const failed = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(failed.body.failureReason).toBe("Final recommendation assistant failed: The final recommendation assistant returned an answer that could not be verified.");
    expect(failed.body.finalRecommendation).toBeNull();
  });
  it("rejects an Approve recommendation when a disputed ZATCA finding requires referral", async () => {
    await seedSourcePack("disputed_invoice");
    const delegate = scriptedAi();
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        if (name === "prepare-final-recommendation") {
          const findings = JSON.parse(inputs.correctedFindings!).findings as { id: string }[];
          return { runId: "unsafe-final", output: JSON.stringify({ outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", missingGradeInputs: [], decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §6", conclusion: "Approve", evidence: "Other checks passed.", findingIds: findings.map(({ id }) => id) }], notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." }) };
        }
        return delegate.runInteraction(name, inputs);
      },
    };
    const app = testApp(mongo.db, { ai, config: { simulatedDataScenario: "disputed_invoice" } });
    const started = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`)).body.status).toBe("failed"));
    const failed = await request(app).get(`/api/applications/case-1/assessment-runs/${started.body.id}`).expect(200);
    expect(failed.body.failureReason).toContain("did not contain valid product policy and evidence citations");
    expect(failed.body.finalRecommendation).toBeNull();
  });
  it("does not fabricate a result when Maitento is not connected", async () => {
    await seedSourcePack();
    await request(testApp(mongo.db)).post("/api/applications/case-1/assessment-runs").send({}).expect(503);
    expect(await mongo.db.collection("applicationCheckRuns").countDocuments()).toBe(0);
  });
  it("allows wording to come from each Maitento run", async () => {
    await seedSourcePack();
    const ai = scriptedAi();
    const app = testApp(mongo.db, { ai });
    const first = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(() => expect(ai.calls.length).toBe(10));
    const second = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(() => expect(ai.calls.length).toBe(20));
    const one = await request(app).get(`/api/applications/case-1/assessment-runs/${first.body.id}`);
    const two = await request(app).get(`/api/applications/case-1/assessment-runs/${second.body.id}`);
    expect(one.body.specialistFindings[0].plainLanguageFinding).not.toBe(two.body.specialistFindings[0].plainLanguageFinding);
  });
  it("shows a safe stage-specific failure and permits a successful rerun", async () => {
    await seedSourcePack();
    const delegate = scriptedAi();
    let failFinal = true;
    const ai: AiRunner = {
      namespace: "test",
      async runInteraction(name, inputs) {
        if (name === "prepare-final-recommendation" && failFinal) {
          failFinal = false;
          throw new Error("provider-token=secret prompt=private stack trace");
        }
        return delegate.runInteraction(name, inputs);
      },
    };
    const app = testApp(mongo.db, { ai });
    const first = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${first.body.id}`)).body.status).toBe("failed"));
    const failed = await request(app).get(`/api/applications/case-1/assessment-runs/${first.body.id}`).expect(200);
    expect(failed.body.failureReason).toBe("Final recommendation assistant failed: Maitento could not complete this stage. Start a new assessment to try again.");
    expect(failed.body.failureReason).not.toMatch(/secret|prompt|stack/i);
    expect(failed.body.steps.slice(0, 5).every((step: { status: string }) => step.status === "completed")).toBe(true);
    expect(failed.body.steps[5]).toMatchObject({ label: "Final recommendation assistant", status: "failed", failureReason: failed.body.failureReason });
    const rerun = await request(app).post("/api/applications/case-1/assessment-runs").send({}).expect(202);
    await vi.waitFor(async () => expect((await request(app).get(`/api/applications/case-1/assessment-runs/${rerun.body.id}`)).body.status).toBe("completed"));
  });
  it("marks a legacy simulated run as sample data when fetched directly", async () => {
    await mongo.db.collection("applications").insertOne({
      _id: "legacy-case",
      businessName: "Legacy Sample Trading",
      businessNameArabic: "تجارة تجريبية",
      commercialRegistration: "1010000077",
      product: "working_capital",
      amountSar: 900000,
      stage: "credit_assessment",
      receivedAt: new Date("2026-11-01T08:00:00Z"),
      city: "Riyadh",
      sampleData: true,
    } as never);
    await mongo.db.collection("applicationCheckRuns").insertOne({
      _id: "legacy-run-1",
      applicationId: "legacy-case",
      scenario: "clean",
      performedAt: new Date("2026-11-02T08:00:00Z"),
      results: [{ specialist: "SIMAH credit bureau", clause: "SME-CP-07 §3.1", outcome: "pass", summary: "Legacy simulated bureau evidence.", evidence: ["Commercial score 714"] }],
      recommendation: { outcome: "Approve", riskGrade: "B", indicativeProfitRate: "SAIBOR + 3.0%", decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1", reasons: [], reviewerChallenges: [] },
      sampleData: true,
      legacy: true,
    } as never);

    const response = await request(testApp(mongo.db)).get("/api/applications/legacy-case/assessment-runs/legacy-run-1").expect(200);
    expect(response.body).toMatchObject({ id: "legacy-run-1", sampleData: true });
  });
});
