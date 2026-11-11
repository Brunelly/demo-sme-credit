import type { ApplicationProduct, ApplicationStage } from "@app/contracts";
import type { Tone } from "@app/ui";

export const productLabels: Record<ApplicationProduct, string> = {
  invoice_financing: "Invoice financing",
  working_capital: "Working capital",
};

export const stageLabels: Record<ApplicationStage, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "info" },
  eligibility_review: { label: "Eligibility review", tone: "neutral" },
  credit_assessment: { label: "Credit assessment", tone: "brand" },
  decision_required: { label: "Decision required", tone: "warning" },
  referred: { label: "Referred", tone: "danger" },
};
