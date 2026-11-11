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
}

export interface ListApplicationsResponse {
  items: CreditApplication[];
  sampleData: boolean;
}
