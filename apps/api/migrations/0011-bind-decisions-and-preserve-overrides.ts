import type { Db } from "mongodb";

/** Binds historical decisions to their assessment and starts the append-only override trail. */
export async function up(db: Db): Promise<void> {
  const decisions = db.collection<{ _id: string; applicationId: string; recordedAt?: string; assessmentRunId?: string }>("creditDecisions");
  const runs = db.collection<{ _id: string; applicationId: string; startedAt?: string; performedAt?: Date; finalRecommendation?: { override?: unknown; overrides?: unknown[] } }>("applicationCheckRuns");

  for await (const decision of decisions.find({ assessmentRunId: { $exists: false } })) {
    const at = decision.recordedAt ?? "9999-12-31T23:59:59.999Z";
    const run = await runs.find({ applicationId: decision.applicationId, $or: [{ startedAt: { $lte: at } }, { performedAt: { $lte: new Date(at) } }] }).sort({ startedAt: -1, performedAt: -1, _id: -1 }).limit(1).next()
      ?? await runs.find({ applicationId: decision.applicationId }).sort({ startedAt: -1, performedAt: -1, _id: -1 }).limit(1).next();
    if (run) await decisions.updateOne({ _id: decision._id, assessmentRunId: { $exists: false } }, { $set: { assessmentRunId: run._id } });
  }

  for await (const run of runs.find({ "finalRecommendation.override": { $exists: true }, "finalRecommendation.overrides": { $exists: false } })) {
    await runs.updateOne(
      { _id: run._id, "finalRecommendation.overrides": { $exists: false } },
      { $set: { "finalRecommendation.overrides": [run.finalRecommendation!.override] } },
    );
  }
}
