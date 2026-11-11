import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MIGRATIONS_COLLECTION,
  MIGRATION_LOCK_COLLECTION,
  MigrationError,
  discoverMigrations,
  migrate,
} from "../src/db/migrations.ts";
import { useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

/** Any document with a string id, for reading and poking at what migrations wrote. */
type Doc = { _id: string; [field: string]: unknown };
const collection = (name: string) => mongo.db.collection<Doc>(name);

// Each test writes its own migration files into a temporary folder.
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "migrations-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(name: string, body: string): void {
  writeFileSync(path.join(dir, name), `import type { Db } from "mongodb";\n${body}\n`);
}

/** A migration that appends its name to the `log` collection, so the order and count of runs can be checked. */
function writeLogging(name: string): void {
  write(name, `export async function up(db: Db) { await db.collection("log").insertOne({ name: "${name}" }); }`);
}

async function ranInOrder(): Promise<string[]> {
  return (await mongo.db.collection("log").find().sort({ _id: 1 }).toArray()).map((d) => d.name as string);
}

describe("migrate", () => {
  it("applies pending migrations in order, once each, and records them", async () => {
    writeLogging("0002-second.ts");
    writeLogging("0001-first.ts");
    writeFileSync(path.join(dir, "README.md"), "not a migration");

    const first = await migrate(mongo.db, { dir });
    expect(first).toEqual({ applied: ["0001-first", "0002-second"], alreadyApplied: [] });

    const again = await migrate(mongo.db, { dir });
    expect(again).toEqual({ applied: [], alreadyApplied: ["0001-first", "0002-second"] });
    expect(await ranInOrder()).toEqual(["0001-first.ts", "0002-second.ts"]);

    const records = await mongo.db.collection(MIGRATIONS_COLLECTION).find().toArray();
    expect(records.map((r) => r._id)).toEqual(["0001-first", "0002-second"]);
    expect(records[0]).toMatchObject({ checksum: expect.stringMatching(/^[0-9a-f]{64}$/), appliedAt: expect.any(Date) });
  });

  it("applies only the new one when a migration is added later", async () => {
    writeLogging("0001-first.ts");
    await migrate(mongo.db, { dir });
    writeLogging("0002-second.ts");

    expect((await migrate(mongo.db, { dir })).applied).toEqual(["0002-second"]);
    expect(await ranInOrder()).toEqual(["0001-first.ts", "0002-second.ts"]);
  });

  it("stops at a failing migration: earlier ones stay applied, it and later ones don't", async () => {
    writeLogging("0001-first.ts");
    write("0002-broken.ts", `export async function up(db: Db) { throw new Error("boom"); }`);
    writeLogging("0003-third.ts");

    await expect(migrate(mongo.db, { dir })).rejects.toThrow("boom");
    const applied = await mongo.db.collection(MIGRATIONS_COLLECTION).find().toArray();
    expect(applied.map((r) => r._id)).toEqual(["0001-first"]);
    expect(await ranInOrder()).toEqual(["0001-first.ts"]);
    expect(await mongo.db.collection(MIGRATION_LOCK_COLLECTION).countDocuments()).toBe(0);
  });

  it("refuses a migration edited after it was applied", async () => {
    writeLogging("0001-first.ts");
    await migrate(mongo.db, { dir });
    write("0001-first.ts", `export async function up(db: Db) { await db.collection("log").insertOne({ edited: true }); }`);

    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/has changed since it was applied/);
  });

  it("ignores line-ending differences when checking for edits", async () => {
    write("0001-first.ts", "export async function up(db: Db) {}");
    await migrate(mongo.db, { dir });
    writeFileSync(path.join(dir, "0001-first.ts"), `import type { Db } from "mongodb";\r\nexport async function up(db: Db) {}\r\n`);

    await expect(migrate(mongo.db, { dir })).resolves.toEqual({ applied: [], alreadyApplied: ["0001-first"] });
  });

  it("refuses when an applied migration's file is gone", async () => {
    writeLogging("0001-first.ts");
    await migrate(mongo.db, { dir });
    rmSync(path.join(dir, "0001-first.ts"));

    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/its file is gone/);
  });

  it("refuses a new migration numbered before one already applied", async () => {
    writeLogging("0002-second.ts");
    await migrate(mongo.db, { dir });
    writeLogging("0001-late.ts");

    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/number it after 0002-second/);
  });

  it("refuses down(), a missing up(), and a bad file name, before applying anything", async () => {
    writeLogging("0001-first.ts");
    write("0002-has-down.ts", "export async function up(db: Db) {}\nexport async function down(db: Db) {}");
    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/up-only/);
    expect(await ranInOrder()).toEqual([]);

    rmSync(path.join(dir, "0002-has-down.ts"));
    write("0002-no-up.ts", "export const nothing = 1;");
    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/doesn't export an up/);

    rmSync(path.join(dir, "0002-no-up.ts"));
    write("2-Bad Name.ts", "export async function up(db: Db) {}");
    await expect(discoverMigrations(dir)).rejects.toThrow(MigrationError);
  });

  it("refuses two migrations with the same number", async () => {
    writeLogging("0001-first.ts");
    writeLogging("0001-also-first.ts");
    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/share the number 0001/);
  });

  it("lets only one run at a time hold the lock", async () => {
    writeLogging("0001-first.ts");
    const future = new Date(Date.now() + 60_000);
    await collection(MIGRATION_LOCK_COLLECTION).insertOne({ _id: "migrate", holder: "other", expiresAt: future });
    await expect(migrate(mongo.db, { dir })).rejects.toThrow(/Another migration run is in progress/);

    // A lock left behind by a crashed run expires, and the next run takes it over.
    await collection(MIGRATION_LOCK_COLLECTION).updateOne({ _id: "migrate" }, { $set: { expiresAt: new Date(0) } });
    expect((await migrate(mongo.db, { dir })).applied).toEqual(["0001-first"]);
  });
});

describe("the app's own migrations", () => {
  // The starter ships none: its first story's data change is 0001. Whatever is here must run from an empty
  // database, then again without doing anything.
  it("run from an empty database, and again without changing anything", async () => {
    const first = await migrate(mongo.db);
    const again = await migrate(mongo.db);
    expect(again).toEqual({ applied: [], alreadyApplied: first.applied });
    expect(await mongo.db.collection(MIGRATIONS_COLLECTION).countDocuments()).toBe(first.applied.length);
  });

  it("ignores the folder's README", async () => {
    expect((await discoverMigrations()).every((m) => m.file.endsWith(".ts"))).toBe(true);
  });

  it("makes each simulated scenario change specialist source facts and preserves product context", async () => {
    await migrate(mongo.db);
    const packs = mongo.db.collection("simulatedAssessmentSources");
    const clean = await packs.findOne({ applicationId: "app-1025", scenarioId: "clean" });
    const disputed = await packs.findOne({ applicationId: "app-1025", scenarioId: "disputed_invoice" });
    const lowBureau = await packs.findOne({ applicationId: "app-1025", scenarioId: "low_bureau" });
    const returnedCheques = await packs.findOne({ applicationId: "app-1025", scenarioId: "returned_cheques" });

    expect(clean).toMatchObject({ sources: {
      "ZATCA e-invoice verification": { productType: "invoice_financing", clearanceStatus: "Cleared", buyerDispute: false, invoiceEligibility: "Eligible — no dispute recorded" },
      "Open banking cash flow": { productType: "invoice_financing", returnedCheques: 1, annualRevenueSar: 28600000 },
    } });
    expect(disputed).toMatchObject({ sources: { "ZATCA e-invoice verification": {
      sourceScenario: "disputed_invoice", productType: "invoice_financing", clearanceStatus: "Not cleared — buyer dispute recorded", buyerDispute: true, invoiceEligibility: "Ineligible while disputed",
    } } });
    expect(lowBureau).toMatchObject({ sources: { "SIMAH credit bureau": { sourceScenario: "low_bureau", commercialScore: 528 } } });
    expect(returnedCheques).toMatchObject({ sources: { "Open banking cash flow": { sourceScenario: "returned_cheques", returnedCheques: 5 } } });
  });
});
