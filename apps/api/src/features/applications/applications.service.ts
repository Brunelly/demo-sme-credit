import { randomUUID } from "node:crypto";
import type { ApplicationCheckRun, ApplicationChecksResponse, CreditApplication, ListApplicationsResponse, SimulatedScenario, SpecialistCheckResult } from "@app/contracts";
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
  async runChecks(applicationId: string): Promise<ApplicationCheckRun> {
    const application = await this.requireApplication(applicationId);
    return this.checks.record({ id: randomUUID(), applicationId, scenario: this.scenario, performedAt: new Date(), results: specialistResults(application, this.scenario) });
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
