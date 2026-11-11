import type { Db } from "mongodb";

/** Retains pre-recommendation simulated runs for audit while keeping them out of the current assessment view. */
export async function up(db: Db): Promise<void> {
  await db.collection("applicationCheckRuns").updateMany(
    { recommendation: { $exists: false }, legacy: { $ne: true } },
    { $set: { legacy: true, legacyReason: "Created before reviewer-challenged recommendations were introduced" } },
  );
}
