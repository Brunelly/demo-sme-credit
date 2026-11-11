import type { Db } from "mongodb";

export async function up(db: Db): Promise<void> {
  const applications = await db.collection("applications").find({ sampleData: true }).limit(100).toArray();
  const sources = db.collection("simulatedAssessmentSources");

  for (const application of applications) {
    const productType = application.product;
    const buyerCategory = (application.invoice as { buyerCategory?: string } | undefined)?.buyerCategory;
    for (const scenarioId of ["clean", "disputed_invoice", "low_bureau", "returned_cheques"] as const) {
      const disputed = scenarioId === "disputed_invoice";
      await sources.updateOne(
        { applicationId: application._id, scenarioId },
        {
          $set: {
            "sources.SIMAH credit bureau.sourceScenario": scenarioId,
            "sources.Wathq company verification.sourceScenario": scenarioId,
            "sources.ZATCA e-invoice verification.sourceScenario": scenarioId,
            "sources.Open banking cash flow.sourceScenario": scenarioId,
            "sources.Open banking cash flow.productType": productType,
            "sources.ZATCA e-invoice verification.productType": productType,
            ...(productType === "invoice_financing" ? {
              "sources.ZATCA e-invoice verification.clearanceStatus": disputed ? "Not cleared — buyer dispute recorded" : "Cleared",
              "sources.ZATCA e-invoice verification.buyerDispute": disputed,
              "sources.ZATCA e-invoice verification.invoiceEligibility": disputed ? "Ineligible while disputed" : "Eligible — no dispute recorded",
              "sources.ZATCA e-invoice verification.buyerCategory": buyerCategory,
            } : {}),
          },
        },
      );
    }
  }
}
