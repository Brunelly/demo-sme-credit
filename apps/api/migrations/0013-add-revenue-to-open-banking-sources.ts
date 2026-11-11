import type { Db } from "mongodb";

export async function up(db: Db): Promise<void> {
  const applications = await db.collection("applications").find({ sampleData: true }).limit(100).toArray();
  const sources = db.collection("simulatedAssessmentSources");

  for (const application of applications) {
    if (typeof application.annualRevenueSar !== "number") continue;
    await sources.updateMany(
      { applicationId: application._id },
      { $set: { "sources.Open banking cash flow.annualRevenueSar": application.annualRevenueSar } },
    );
  }
}
