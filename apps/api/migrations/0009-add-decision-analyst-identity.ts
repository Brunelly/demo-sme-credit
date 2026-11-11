import type { Db } from "mongodb";

/** Marks historical decision actors as legacy identities; all new records use the authenticated platform id. */
export async function up(db: Db): Promise<void> {
  const decisions = db.collection<{ _id: string; analystId?: string }>("creditDecisions");
  for await (const decision of decisions.find({ analystId: { $exists: false } }, { projection: { _id: 1 } })) {
    await decisions.updateOne({ _id: decision._id, analystId: { $exists: false } }, { $set: { analystId: `legacy:${decision._id}` } });
  }
}
