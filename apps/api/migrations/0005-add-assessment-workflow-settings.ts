import type { Db } from "mongodb";
export async function up(db: Db): Promise<void> {
  await db.collection<{ _id: string; [key: string]: unknown }>("simulatedScenarioSettings").updateOne(
    { _id: "active" },
    { $setOnInsert: { activeScenarioId: "clean", version: 1, updatedAt: new Date(0).toISOString(), updatedBy: "Credit analyst" } },
    { upsert: true },
  );
}
