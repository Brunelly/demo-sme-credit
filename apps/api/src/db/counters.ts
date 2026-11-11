import type { Db } from "mongodb";

export const COUNTERS_COLLECTION = "counters";

export interface CounterDocument {
  _id: string;
  seq: number;
}

/**
 * The next number in a named sequence (1, 2, 3, …), for human-friendly references such as T-1004. One atomic
 * $inc, so two requests (or two copies of the app) never get the same number. Ids stay UUIDs: a sequence is for
 * people, never for lookups by the code.
 */
export async function nextSequence(db: Db, name: string): Promise<number> {
  const counter = await db
    .collection<CounterDocument>(COUNTERS_COLLECTION)
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  if (!counter) throw new Error(`The ${name} counter could not be advanced.`);
  return counter.seq;
}
