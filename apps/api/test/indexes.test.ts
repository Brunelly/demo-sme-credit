import type { IndexDescription } from "mongodb";
import { describe, expect, it } from "vitest";
import { INDEXES, ensureIndexes } from "../src/db/indexes.ts";
import { useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

/** A collection's indexes as a feature would declare them, so the runner is tested before any feature exists. */
const examples: Record<string, IndexDescription[]> = { examples: [{ key: { owner: 1 }, name: "owner" }, { key: { createdAt: -1 }, name: "newest" }] };

async function indexNames(collection: string): Promise<string[]> {
  return (await mongo.db.collection(collection).indexes()).map((index) => index.name!).sort();
}

describe("ensureIndexes", () => {
  it("creates every declared index, and is safe to run again", async () => {
    await ensureIndexes(mongo.db, examples);
    await ensureIndexes(mongo.db, examples);
    expect(await indexNames("examples")).toEqual(["_id_", "newest", "owner"]);
  });

  it("creates the app's own indexes", async () => {
    await ensureIndexes(mongo.db);
    for (const [collection, indexes] of Object.entries(INDEXES)) {
      expect(await indexNames(collection)).toEqual(["_id_", ...indexes.map((index) => index.name!)].sort());
    }
  });

  it("recreates an index whose options changed", async () => {
    const before: Record<string, IndexDescription[]> = { examples: [{ key: { owner: 1 }, name: "owner" }] };
    const after: Record<string, IndexDescription[]> = { examples: [{ key: { owner: 1 }, name: "owner", unique: true }] };
    await ensureIndexes(mongo.db, before);
    await ensureIndexes(mongo.db, after);

    const index = (await mongo.db.collection("examples").indexes()).find((i) => i.name === "owner");
    expect(index?.unique).toBe(true);
  });

  it("refuses an index without a name", async () => {
    await expect(ensureIndexes(mongo.db, { examples: [{ key: { title: 1 } }] })).rejects.toThrow(/no name/);
  });
});
