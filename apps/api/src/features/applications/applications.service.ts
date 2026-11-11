import { randomUUID } from "node:crypto";
import type { ApplicationCheckRun, ApplicationChecksResponse, CreditApplication, CreditRecommendation, ListApplicationsResponse, OverrideReason, RecommendationOutcome, SimulatedScenario, SpecialistCheckResult } from "@app/contracts";
import { NotFoundError } from "../../errors.ts";
import type { ApplicationChecksRepository } from "./application-checks.repository.ts";
import type { ApplicationsRepository } from "./applications.repository.ts";

export class ApplicationsService {
  private readonly repository: ApplicationsRepository;
  private readonly checks: ApplicationChecksRepository;
  private readonly scenario: SimulatedScenario;

  constructor(repository: ApplicationsRepository, checks: ApplicationChecksRepository, scenario: SimulatedScenario) {
    this.repository = repository;
    this.checks = checks;
    this.scenario = scenario;
  }

  /** Returns the analyst queue ordered oldest first. */
  list(): Promise<ListApplicationsResponse> {
    return this.repository.list();
  }


  async latestChecks(applicationId: string): Promise<ApplicationChecksResponse> {
    await this.requireApplication(applicationId);
    return { latest: await this.checks.latest(applicationId), simulatedData: true };
  }

  /** Runs and records the four policy specialists against the configured simulated source data. */
  async runChecks(applicationId: string, request: { scenario?: SimulatedScenario } = {}): Promise<ApplicationCheckRun> {
    const application = await this.requireApplication(applicationId);
    const scenario = request.scenario ?? this.scenario;
    const results = specialistResults(application, scenario);
    return this.checks.record({ id: randomUUID(), applicationId, scenario, performedAt: new Date(), results, recommendation: formRecommendation(application, scenario, results) });
  }

  /** Records the analyst's human override on the assessment run. */
  async recordOverride(applicationId: string, runId: string, input: { outcome: RecommendationOutcome; reason: OverrideReason; rationale: string }): Promise<ApplicationCheckRun> {
    await this.requireApplication(applicationId);
    const updated = await this.checks.recordOverride(applicationId, runId, {
      outcome: input.outcome,
      reason: input.reason,
      rationale: input.rationale,
      recordedAt: new Date().toISOString(),
      recordedBy: "Credit analyst",
    });
    if (!updated) throw new NotFoundError("The assessment run was not found.");
    return updated;
  }

  private async requireApplication(id: string): Promise<CreditApplication> {
    const application = await this.repository.find(id);
    if (!application) throw new NotFoundError("The financing application was not found.");
    return application;
  }
}

function specialistResults(application: CreditApplication, scenario: SimulatedScenario): SpecialistCheckResult[] {
  const invoice = application.invoice;
  const bureauRefer = scenario === "low_bureau";
  const invoiceRefer = scenario === "disputed_invoice" && application.product === "invoice_financing";
  const cashRefer = scenario === "returned_cheques";
  return [
    { specialist: "SIMAH credit bureau", clause: "SME-CP-07 §3.1", outcome: bureauRefer ? "refer" : "pass", summary: bureauRefer ? "High risk bureau band requires analyst review." : "Commercial and qualifying owner reports are within policy.", evidence: bureauRefer ? ["Commercial score 528 · High risk", "Owner reports checked"] : ["Commercial score 714 · Low risk", "Owner reports checked"] },
    { specialist: "Wathq company verification", clause: "SME-CP-07 §3.2", outcome: "pass", summary: "CR tenure, activity and authorised signatory match the application.", evidence: ["CR active for 38 months", "Registered activity matches finance purpose", "Signatory authorised"] },
    { specialist: "ZATCA e-invoice verification", clause: "SME-CP-07 §3.3", outcome: invoiceRefer ? "refer" : "pass", summary: invoiceRefer ? "Invoice is disputed and cannot be treated as eligible evidence." : invoice ? "Clearance record matches the submitted invoice." : "No invoice check is required for this working-capital application.", evidence: invoiceRefer ? [`${invoice?.number ?? "Submitted invoice"} · buyer dispute recorded`, "No duplicate pledge found"] : invoice ? [`${invoice.number} · cleared`, `${invoice.buyerCategory} buyer · ${invoice.buyerName}`, "Number, VAT, amount and date match"] : ["Not applicable · working capital"] },
    { specialist: "Open banking cash flow", clause: "SME-CP-07 §3.4", outcome: cashRefer ? "refer" : "pass", summary: cashRefer ? "Returned cheque activity exceeds the policy referral threshold." : "Twelve months of statement activity supports the requested facility.", evidence: cashRefer ? ["12 months analysed", "5 returned cheques", "Existing obligations included"] : ["12 months analysed", "Average monthly inflow SAR 2,480,000", "1 returned cheque · existing obligations included"] },
  ];
}

function formRecommendation(application: CreditApplication, scenario: SimulatedScenario, results: SpecialistCheckResult[]): CreditRecommendation {
  const hasReferral = results.some((result) => result.outcome === "refer");
  const outcome: RecommendationOutcome = scenario === "ineligible_revenue" ? "Decline" : hasReferral ? "Refer" : "Approve";
  const riskGrade = scenario === "low_bureau" ? "D" : application.riskGrade ?? (outcome === "Approve" ? "B" : "C");
  const reasons: CreditRecommendation["reasons"] = [];

  if (scenario === "ineligible_revenue") {
    reasons.push({ clause: "SME-CP-07 §2.2", conclusion: "Annual revenue is outside the eligible SME range.", evidence: "Simulated financial statements show annual revenue of SAR 2,400,000; policy range is SAR 3–200 million." });
  } else {
    reasons.push(
      { clause: "SME-CP-07 §2.1", conclusion: "Commercial Registration tenure is eligible.", evidence: "Wathq record shows an active CR for 38 months." },
      { clause: "SME-CP-07 §2.2", conclusion: "Annual revenue is within the eligible range.", evidence: `Financial statements show ${formatSar(application.annualRevenueSar ?? 28_600_000)} annual revenue.` },
      { clause: "SME-CP-07 §§2.3–2.5", conclusion: "Tax, sanctions and recent-default eligibility checks are clear.", evidence: "ZATCA registration is in good standing; screening returned no sanctions match; SIMAH found no default in 24 months." },
    );
  }

  if (application.product === "invoice_financing") {
    const invoice = application.invoice;
    if (scenario === "disputed_invoice") {
      reasons.push({ clause: "SME-CP-07 §§4.1, 4.5", conclusion: "Refer because the invoice is disputed.", evidence: `${invoice?.number ?? "Submitted invoice"} has a buyer dispute recorded in the simulated ZATCA check.` });
    } else {
      const rate = invoice?.buyerCategory === "Government" ? 85 : invoice?.buyerCategory === "Listed" ? 80 : invoice?.buyerCategory === "Established private" ? 70 : 0;
      reasons.push(
        { clause: "SME-CP-07 §§4.1, 4.4", conclusion: "Invoice is eligible by tenor, dispute and related-party rules.", evidence: `${invoice?.number ?? "Submitted invoice"} is due in 74 days, undisputed, delivered and not related-party.` },
        { clause: "SME-CP-07 §§4.2–4.3", conclusion: rate ? `Buyer quality supports an advance rate up to ${rate}%; concentration is within limit.` : "Other buyer category requires referral.", evidence: `${invoice?.buyerCategory ?? "Other"} buyer; largest-buyer concentration is 36% of the facility.` },
      );
    }
  } else {
    reasons.push(
      { clause: "SME-CP-07 §5.1", conclusion: "Requested limit is within the policy cap.", evidence: `Requested ${formatSar(application.amountSar)}; lower cap is ${formatSar(Math.min((application.annualRevenueSar ?? 28_600_000) * 0.25, 7_440_000))} from revenue and average inflow.` },
      { clause: "SME-CP-07 §§5.2, 5.4", conclusion: "Coverage and tenor meet policy.", evidence: "Statement cash flows give 1.48× DSCR; requested tenor is 12 months." },
    );
    if (scenario === "returned_cheques") reasons.push({ clause: "SME-CP-07 §5.3", conclusion: "Refer because returned cheques exceed the threshold.", evidence: "Open-banking evidence records 5 returned cheques in 12 months." });
  }

  if (scenario === "low_bureau") reasons.push({ clause: "SME-CP-07 §§3.1, 6", conclusion: "High bureau risk creates a grade D exception.", evidence: "SIMAH commercial score is 528 (High risk band)." });
  reasons.push({ clause: "SME-CP-07 §6", conclusion: `Risk grade ${riskGrade} sets the indicative pricing basis.`, evidence: `Bureau band and 1.48× DSCR support ${riskGrade === "D" ? "credit committee pricing" : `grade ${riskGrade}`}.` });

  const reviewerChallenges = results.map((result) => ({
    specialist: result.specialist,
    status: result.outcome === "refer" ? "challenge" as const : "confirmed" as const,
    conclusion: result.outcome === "refer" ? `Reviewer challenges the specialist conclusion: ${result.summary}` : `Reviewer tested the conclusion and found it supported by the cited evidence.`,
    evidenceGap: result.outcome === "refer" ? (result.specialist.startsWith("ZATCA") ? "Obtain signed buyer confirmation before approval." : result.specialist.startsWith("Open banking") ? "Analyst must confirm whether reversals were operational errors." : "A policy exception cannot be cleared at analyst level.") : undefined,
  }));

  const decisionAuthority = authorityFor(outcome, application.amountSar, riskGrade);
  return { outcome, riskGrade, indicativeProfitRate: riskGrade === "A" ? "SAIBOR + 2.25%" : riskGrade === "B" ? "SAIBOR + 3.0%" : riskGrade === "C" ? "SAIBOR + 4.0%" : "Credit committee only", decisionAuthority, authorityClause: "SME-CP-07 §7.1", reasons, reviewerChallenges };
}

function authorityFor(outcome: RecommendationOutcome, amountSar: number, riskGrade: "A" | "B" | "C" | "D"): string {
  if (amountSar > 5_000_000 || riskGrade === "D") return "Credit committee — amount above SAR 5m, grade D or policy exception";
  if (outcome === "Refer") return "Credit analyst reviews the flagged checks";
  if (outcome === "Decline") return "Credit analyst, then a second analyst (four eyes)";
  if (amountSar > 2_000_000) return "Senior credit officer";
  return "Credit analyst confirms";
}

function formatSar(value: number): string {
  return `SAR ${new Intl.NumberFormat("en-SA", { maximumFractionDigits: 0 }).format(value)}`;
}
