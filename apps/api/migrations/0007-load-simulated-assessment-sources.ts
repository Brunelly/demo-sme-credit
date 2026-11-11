import type { Db } from "mongodb";

const scenarios = ["clean", "disputed_invoice", "low_bureau", "returned_cheques", "ineligible_revenue"] as const;

export async function up(db: Db): Promise<void> {
  const applications = await db.collection("applications").find({ sampleData: true }).limit(100).toArray();
  const collection = db.collection<{ _id: string }>("simulatedAssessmentSources");
  for (const application of applications) {
    for (const scenario of scenarios) {
      const id = `${application._id}:${scenario}`;
      const invoice = application.invoice as { number?: string; buyerName?: string; buyerCategory?: string; amountSar?: number } | undefined;
      await collection.updateOne({ _id: id }, { $setOnInsert: {
        _id: id, applicationId: application._id, scenarioId: scenario, sampleData: true,
        sources: {
          "SIMAH credit bureau": { source: "Simulated SIMAH commercial and qualifying-owner reports", commercialScore: scenario === "low_bureau" ? 528 : 714, ownerReportsCheckedAtOrAbovePercent: 25, defaultsWriteOffsOrRestructuresLast24Months: 0 },
          "Wathq company verification": { source: "Simulated Wathq CR record", commercialRegistration: application.commercialRegistration, status: "active", activeMonths: 38, registeredActivityMatchesPurpose: true, signatoryAuthorised: true },
          "ZATCA e-invoice verification": application.product === "working_capital" ? { source: "Simulated ZATCA source", applicable: false, reason: "Working-capital product" } : { source: "Simulated ZATCA clearance record", applicable: true, invoiceNumber: invoice?.number, buyerName: invoice?.buyerName, buyerVatNumber: "310123456700003", amountSar: invoice?.amountSar, issueDate: "2026-10-27", clearanceStatus: "Cleared", fieldsMatch: true, previouslyFinancedOrPledged: false, buyerDispute: scenario === "disputed_invoice", buyerCategory: invoice?.buyerCategory },
          "Open banking cash flow": { source: "Simulated 12-month bank statements", statementMonths: 12, averageMonthlyInflowSar: 2480000, inflowVolatilityPercent: 11.4, returnedCheques: scenario === "returned_cheques" ? 5 : 1, monthlyExistingObligationsSar: 620000, dscr: 1.48 },
        },
      } }, { upsert: true });
    }
  }
}
