import { z } from "zod";

export const applicationProductSchema = z.enum(["invoice_financing", "working_capital"]);
export const applicationStageSchema = z.enum(["new", "eligibility_review", "credit_assessment", "decision_required", "referred"]);

export type ApplicationProduct = z.infer<typeof applicationProductSchema>;
export type ApplicationStage = z.infer<typeof applicationStageSchema>;

export interface CreditApplication {
  id: string;
  businessName: string;
  businessNameArabic: string;
  commercialRegistration: string;
  product: ApplicationProduct;
  amountSar: number;
  stage: ApplicationStage;
  receivedAt: string;
  city: string;
  riskGrade?: "A" | "B" | "C" | "D";
  annualRevenueSar?: number;
  invoice?: { number: string; buyerName: string; buyerCategory: "Government" | "Listed" | "Established private" | "Other"; amountSar: number };
}

export interface ListApplicationsResponse {
  items: CreditApplication[];
  sampleData: boolean;
}

export const simulatedScenarioSchema = z.enum(["clean", "disputed_invoice", "low_bureau", "returned_cheques"]);
export type SimulatedScenario = z.infer<typeof simulatedScenarioSchema>;
export type SpecialistOutcome = "pass" | "refer";

export interface SpecialistCheckResult {
  specialist: "SIMAH credit bureau" | "Wathq company verification" | "ZATCA e-invoice verification" | "Open banking cash flow";
  clause: "SME-CP-07 §3.1" | "SME-CP-07 §3.2" | "SME-CP-07 §3.3" | "SME-CP-07 §3.4";
  outcome: SpecialistOutcome;
  summary: string;
  evidence: string[];
}

export interface ApplicationCheckRun {
  id: string;
  applicationId: string;
  scenario: SimulatedScenario;
  performedAt: string;
  results: SpecialistCheckResult[];
}

export interface ApplicationChecksResponse {
  latest: ApplicationCheckRun | null;
  simulatedData: true;
}
