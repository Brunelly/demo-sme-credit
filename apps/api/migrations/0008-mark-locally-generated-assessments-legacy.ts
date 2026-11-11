import type { Db } from "mongodb";

/** Keeps pre-Maitento demo runs for audit and review-queue compatibility, but removes them from live assessment history. */
export async function up(db: Db): Promise<void> {
  await db.collection("applicationCheckRuns").updateMany(
    { results: { $exists: true }, legacy: { $ne: true } },
    { $set: { legacy: true, legacyReason: "Created before assessments were executed through Maitento" } },
  );
}
