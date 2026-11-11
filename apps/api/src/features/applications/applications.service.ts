import { randomUUID } from "node:crypto";
import type { ApplicationCheckRun, CreditApplication, CreditRecommendation, OverrideReason, RecommendationOutcome, SimulatedScenario, SpecialistFinding, SpecialistType } from "@app/contracts";
import { NotFoundError, ValidationError } from "../../errors.ts";
import type { ApplicationChecksRepository } from "./application-checks.repository.ts";
import type { ApplicationsRepository } from "./applications.repository.ts";
import type { SimulatedScenarioRepository } from "./simulated-scenario.repository.ts";

const SPECIALISTS: SpecialistType[] = ["SIMAH credit bureau", "Wathq company verification", "ZATCA e-invoice verification", "Open banking cash flow"];
const ALLOWED_RECOMMENDATION_CITATION = /^SME-CP-07 §(?:§)?(?:2(?:\.[1-5])?|4(?:\.[1-5])?|5(?:\.[1-4])?|6)(?:[–, ]+\d(?:\.\d+)?)?$/;
export function validateRecommendationCitations(recommendation: CreditRecommendation): boolean {
  return recommendation.reasons.length > 0 && recommendation.reasons.every((reason) => ALLOWED_RECOMMENDATION_CITATION.test(reason.clause) && reason.findingIds.length > 0);
}
export function buildSpecialistPromptPayload(application: CreditApplication, scenario: SimulatedScenario, specialist: SpecialistType): Record<string, string> {
  return { sourceData: JSON.stringify({ applicationId: application.id, product: application.product, scenario, assignedSource: specialist, simulated: true }) };
}

export class ApplicationsService {
  private readonly repository: ApplicationsRepository; private readonly checks: ApplicationChecksRepository; private readonly scenarios: SimulatedScenarioRepository;
  constructor(repository: ApplicationsRepository, checks: ApplicationChecksRepository, scenarios: SimulatedScenarioRepository) { this.repository = repository; this.checks = checks; this.scenarios = scenarios; }
  list() { return this.repository.list(); }
  async latestChecks(applicationId: string) { await this.requireApplication(applicationId); return { latest: await this.checks.latest(applicationId), simulatedData: true as const }; }
  async listRuns(applicationId: string) { await this.requireApplication(applicationId); return { items: await this.checks.list(applicationId), simulatedData: true as const }; }
  async getRun(applicationId: string, runId: string) { await this.requireApplication(applicationId); const run = await this.checks.find(applicationId, runId); if (!run) throw new NotFoundError("The assessment run was not found."); return run; }
  async runChecks(applicationId: string): Promise<ApplicationCheckRun> {
    const application = await this.requireApplication(applicationId); const setting = await this.scenarios.get(); const now = new Date().toISOString();
    const originals = createFindings(application, setting.activeScenarioId, now);
    const challenges = originals.map((finding) => createReview(finding, setting.activeScenarioId, now));
    const revised = challenges.filter((item) => item.status === "challenge").map((challenge) => reviseFinding(originals.find((item) => item.id === challenge.findingId)!, challenge, now));
    const recommendation = formRecommendation(application, setting.activeScenarioId, originals, revised, now);
    if (!validateRecommendationCitations(recommendation)) throw new ValidationError("The AI recommendation did not contain valid policy and evidence citations.");
    return this.checks.record({ id: randomUUID(), applicationId, scenarioId: setting.activeScenarioId, scenarioVersion: setting.version, status: "completed", startedAt: now, completedAt: now, specialistFindings: originals, reviewerChallenges: challenges, revisedFindings: revised, finalRecommendation: recommendation, failureReason: null, createdBy: "Credit analyst" });
  }
  async recordOverride(applicationId: string, runId: string, input: { outcome: RecommendationOutcome; reason: OverrideReason; rationale: string }) {
    await this.requireApplication(applicationId); const updated = await this.checks.recordOverride(applicationId, runId, { ...input, recordedAt: new Date().toISOString(), recordedBy: "Credit analyst" });
    if (!updated) throw new NotFoundError("The completed assessment run was not found."); return updated;
  }
  private async requireApplication(id: string) { const item = await this.repository.find(id); if (!item) throw new NotFoundError("The financing application was not found."); return item; }
}

function finding(specialistType: SpecialistType, outcome: SpecialistFinding["outcome"], plainLanguageFinding: string, sourceLabel: string, facts: string[], policyCitations: string[], createdAt: string): SpecialistFinding {
  return { id: randomUUID(), specialistType, round: 1, outcome, plainLanguageFinding, sourceLabel, evidence: facts.map((fact, index) => ({ fact, sourceReference: `${sourceLabel} · item ${index + 1}` })), policyCitations, createdAt, revisionSummary: null };
}
function createFindings(app: CreditApplication, scenario: SimulatedScenario, at: string): SpecialistFinding[] {
  const invoice = app.invoice; const invoiceIssue = scenario === "disputed_invoice" && app.product === "invoice_financing"; const low = scenario === "low_bureau"; const cheques = scenario === "returned_cheques";
  return [
    finding("SIMAH credit bureau", low ? "refer" : "pass", low ? "The commercial score is in the High band. Although the qualifying owner reports were checked, the score does not support an unqualified approval." : "The commercial score is Low risk and the required personal reports for every owner holding 25% or more show no recent default.", "Simulated SIMAH commercial and owner reports", [low ? "Commercial score 528 (High risk)" : "Commercial score 714 (Low risk)", "Owner reports: all owners holding 25% or more checked", "No default, write-off or restructure in the last 24 months"], ["SME-CP-07 §3.1"], at),
    finding("Wathq company verification", "pass", "The active CR has sufficient tenure, the registered activity supports the finance purpose, and the submitted signatory is authorised.", "Simulated Wathq CR record", ["CR active for 38 months", "Registered activity matches finance purpose", "Signatory is authorised"], ["SME-CP-07 §3.2", "SME-CP-07 §2.1"], at),
    finding("ZATCA e-invoice verification", invoiceIssue ? "refer" : "pass", app.product === "working_capital" ? "Invoice and buyer-quality checks are not applicable to this working-capital application." : invoiceIssue ? "The clearance record matches the invoice fields, but the buyer dispute means the invoice cannot be treated as eligible without human review." : "The cleared e-invoice matches the submitted number, buyer VAT number, amount and date, and has no prior-financing indication. Buyer quality is supported for invoice financing.", "Simulated ZATCA clearance record", app.product === "working_capital" ? ["Not applicable: working-capital product"] : [`Invoice ${invoice?.number}; buyer VAT 310123456700003`, `Amount SAR ${invoice?.amountSar.toLocaleString("en-SA")}; issued 27 Oct 2026; clearance status Cleared`, invoiceIssue ? "Buyer dispute recorded; no prior-financing indication" : "Fields match; no duplicate, pledge or prior financing", `Buyer category: ${invoice?.buyerCategory}`], ["SME-CP-07 §3.3", "SME-CP-07 §3.5"], at),
    finding("Open banking cash flow", cheques ? "refer" : "pass", cheques ? "All 12 statement months were analysed. Five returned cheques exceed the referral threshold after obligations are included." : "All 12 statement months were analysed. Inflow, volatility, returned cheques and existing obligations support the cash-flow conclusion.", "Simulated 12-month bank statements", ["12 of 12 months analysed", "Average monthly inflow SAR 2,480,000", cheques ? "5 returned cheques" : "1 returned cheque", "Existing obligations included; DSCR 1.48×"], ["SME-CP-07 §3.4", "SME-CP-07 §5.2", "SME-CP-07 §5.3"], at),
  ];
}
function createReview(f: SpecialistFinding, scenario: SimulatedScenario, at: string) {
  const challenged = f.outcome === "refer"; return { id: randomUUID(), findingId: f.id, specialistType: f.specialistType, status: challenged ? "challenge" as const : "accepted" as const, conclusion: challenged ? "The conclusion needs a bounded rework pass that explicitly connects the exception evidence to the policy consequence." : "The finding is supported by its assigned source and policy citations; retain the first pass.", evidenceGap: challenged ? (scenario === "disputed_invoice" ? "State how the recorded dispute affects invoice eligibility and escalation." : scenario === "returned_cheques" ? "State the count and §5.3 threshold explicitly." : "State the score band and resulting exception explicitly.") : null, reasoningDefect: challenged ? "The first pass identifies the risk but does not state the policy consequence precisely enough." : null, policyCitation: challenged ? (scenario === "disputed_invoice" ? "SME-CP-07 §4.5" : scenario === "returned_cheques" ? "SME-CP-07 §5.3" : "SME-CP-07 §6") : null, createdAt: at };
}
function reviseFinding(original: SpecialistFinding, challenge: ReturnType<typeof createReview>, at: string): SpecialistFinding {
  return { ...original, id: randomUUID(), round: 2, createdAt: at, plainLanguageFinding: `${original.plainLanguageFinding} Rework response: ${challenge.evidenceGap} The original Refer conclusion remains unchanged because the cited exception is material.`, policyCitations: [...new Set([...original.policyCitations, challenge.policyCitation!])], revisionSummary: "Added the reviewer-requested policy consequence and retained the conclusion because the source evidence is unchanged." };
}
function formRecommendation(app: CreditApplication, scenario: SimulatedScenario, originals: SpecialistFinding[], revised: SpecialistFinding[], at: string): CreditRecommendation {
  const corrected = originals.map((item) => revised.find((revision) => revision.specialistType === item.specialistType) ?? item); const ids = (type: SpecialistType) => [corrected.find((f) => f.specialistType === type)!.id];
  const hasRefer = corrected.some((f) => f.outcome !== "pass"); const outcome: RecommendationOutcome = scenario === "ineligible_revenue" ? "Decline" : hasRefer ? "Refer" : "Approve";
  const reasons = [{ clause: "SME-CP-07 §2.1", conclusion: "The active CR meets the tenure requirement.", evidence: "Wathq records 38 active months.", findingIds: ids("Wathq company verification") }];
  if (app.product === "invoice_financing") reasons.push({ clause: scenario === "disputed_invoice" ? "SME-CP-07 §4.5" : "SME-CP-07 §4.2", conclusion: scenario === "disputed_invoice" ? "Refer: the disputed invoice requires escalation and cannot be silently approved." : "The eligible buyer category supports the applicable advance rate; concentration is within 40%.", evidence: scenario === "disputed_invoice" ? "The corrected ZATCA finding records the buyer dispute." : `${app.invoice?.buyerCategory} buyer; concentration 36%; no mismatch, duplicate or related party.`, findingIds: ids("ZATCA e-invoice verification") });
  else reasons.push({ clause: scenario === "returned_cheques" ? "SME-CP-07 §5.3" : "SME-CP-07 §5.2", conclusion: scenario === "returned_cheques" ? "Refer: returned cheques exceed policy." : "DSCR and statement coverage meet policy.", evidence: scenario === "returned_cheques" ? "Corrected cash-flow finding records 5 returned cheques in 12 months." : "Twelve months analysed; DSCR 1.48×; requested tenor 12 months.", findingIds: ids("Open banking cash flow") });
  if (scenario === "ineligible_revenue") reasons.push({ clause: "SME-CP-07 §2.2", conclusion: "Decline: annual revenue is below the eligible SME range.", evidence: "Simulated financial statements show SAR 2,400,000 against the SAR 3 million minimum.", findingIds: ids("Wathq company verification") });
  if (scenario === "low_bureau") reasons.push({ clause: "SME-CP-07 §6", conclusion: "Refer: High bureau risk requires grade D committee consideration.", evidence: "Corrected SIMAH finding records score 528.", findingIds: ids("SIMAH credit bureau") });
  const grade = scenario === "low_bureau" ? "D" : app.riskGrade ?? (outcome === "Approve" ? "B" : "C"); const pricing = grade === "D" ? "Credit committee only" : grade === "A" ? "SAIBOR + 2.25%" : grade === "B" ? "SAIBOR + 3.0%" : "SAIBOR + 4.0%";
  return { outcome, riskGrade: grade, indicativeProfitRate: pricing, decisionAuthority: app.amountSar > 5_000_000 || grade === "D" ? "Credit committee" : outcome === "Decline" ? "Credit analyst, then a second analyst (four eyes)" : outcome === "Refer" ? "Credit analyst reviews the flagged checks" : app.amountSar > 2_000_000 ? "Senior credit officer" : "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1", reasons, notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: at };
}
