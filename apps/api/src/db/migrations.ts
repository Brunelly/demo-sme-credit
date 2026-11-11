import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Db } from "mongodb";
import { isDuplicateKeyError } from "./client.ts";

// The migration runner. Every change to the data's shape or content is a numbered file in apps/api/migrations/
// that exports `up(db)`. This applies the files a database hasn't had yet, in order, once each, and records
// each one in the _migrations collection. There is no `down`: a deploy that goes wrong is rolled back to the
// database as it was before, never by a script.

export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../migrations");
export const MIGRATIONS_COLLECTION = "_migrations";
export const MIGRATION_LOCK_COLLECTION = "_migrations_lock";

/** 0001-short-name.ts: four digits, a dash, lower-case words joined by dashes. */
const FILE_NAME = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;
const LOCK_ID = "migrate";
const LOCK_TTL_MS = 30 * 60_000;

export interface MigrationRecord {
  /** The file name without .ts, e.g. 0001-load-categories. */
  _id: string;
  /** SHA-256 of the file as it was applied, to catch an applied migration being edited. */
  checksum: string;
  appliedAt: Date;
  durationMs: number;
}

export interface MigrationFile {
  id: string;
  file: string;
  checksum: string;
}

export interface MigrateResult {
  /** Applied by this run, in order. */
  applied: string[];
  /** Already applied before this run. */
  alreadyApplied: string[];
}

export interface MigrateOptions {
  dir?: string;
  log?: (message: string) => void;
}

interface MigrationModule {
  up?: unknown;
  down?: unknown;
}

interface LockDocument {
  _id: string;
  holder: string;
  acquiredAt: Date;
  expiresAt: Date;
}

/** A migration problem the developer has to fix: the message says what to do. */
export class MigrationError extends Error {}

/** The migration files in a folder, in the order they apply. Anything that isn't a .ts file (a README) is ignored. */
export async function discoverMigrations(dir: string = MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith(".ts")).sort();
  const seen = new Map<string, string>();
  const files: MigrationFile[] = [];
  for (const name of names) {
    const match = FILE_NAME.exec(name);
    if (!match) throw new MigrationError(`${name}: name migrations like 0001-short-name.ts.`);
    const number = match[1]!;
    const clash = seen.get(number);
    if (clash) throw new MigrationError(`${clash} and ${name} share the number ${number}: renumber the newer one.`);
    seen.set(number, name);
    const file = path.join(dir, name);
    // Hash with \n line endings, so a checkout with \r\n doesn't look like an edit.
    const content = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
    files.push({ id: name.slice(0, -3), file, checksum: createHash("sha256").update(content).digest("hex") });
  }
  return files;
}

/** Applies every migration the database hasn't had yet, in order. Safe to run again: it then does nothing. */
export async function migrate(db: Db, options: MigrateOptions = {}): Promise<MigrateResult> {
  const log = options.log ?? (() => {});
  const files = await discoverMigrations(options.dir);
  const lock = await acquireLock(db);
  try {
    const records = db.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
    const applied = new Map((await records.find({}).limit(10_000).toArray()).map((r) => [r._id, r]));
    checkHistory(files, applied);

    const pending = files.filter((file) => !applied.has(file.id));
    // Load every pending file before running any, so a broken one stops the run before it changes anything.
    const modules = await Promise.all(pending.map(async (file) => ({ file, up: await loadUp(file) })));

    const result: MigrateResult = { applied: [], alreadyApplied: [...applied.keys()].sort() };
    for (const { file, up } of modules) {
      log(`applying ${file.id}`);
      const started = Date.now();
      await up(db);
      const durationMs = Date.now() - started;
      await records.insertOne({ _id: file.id, checksum: file.checksum, appliedAt: new Date(), durationMs });
      await lock.renew();
      log(`applied ${file.id} in ${durationMs} ms`);
      result.applied.push(file.id);
    }
    return result;
  } finally {
    await lock.release();
  }
}

function checkHistory(files: MigrationFile[], applied: Map<string, MigrationRecord>): void {
  const byId = new Map(files.map((file) => [file.id, file]));
  for (const id of applied.keys()) {
    if (!byId.has(id)) {
      throw new MigrationError(`${id} was applied to this database but its file is gone. Never delete or rename an applied migration.`);
    }
  }
  for (const file of files) {
    const record = applied.get(file.id);
    if (record && record.checksum !== file.checksum) {
      throw new MigrationError(`${file.id} has changed since it was applied. Never edit an applied migration: put the change in a new one.`);
    }
  }
  const lastApplied = [...applied.keys()].sort().at(-1);
  const firstPending = files.find((file) => !applied.has(file.id));
  if (lastApplied && firstPending && firstPending.id < lastApplied) {
    throw new MigrationError(`${firstPending.id} is new, but ${lastApplied} has already been applied: number it after ${lastApplied}.`);
  }
}

async function loadUp(file: MigrationFile): Promise<(db: Db) => Promise<void>> {
  const module = (await import(pathToFileURL(file.file).href)) as MigrationModule;
  if (module.down !== undefined) {
    throw new MigrationError(`${file.id} exports down(). Migrations are up-only: remove it.`);
  }
  if (typeof module.up !== "function") {
    throw new MigrationError(`${file.id} doesn't export an up(db) function.`);
  }
  return module.up as (db: Db) => Promise<void>;
}

/**
 * One migration run at a time per database. A second run fails at once rather than applying the same files twice;
 * a lock left by a crashed run expires after 30 minutes.
 */
async function acquireLock(db: Db): Promise<{ renew(): Promise<void>; release(): Promise<void> }> {
  const locks = db.collection<LockDocument>(MIGRATION_LOCK_COLLECTION);
  const holder = randomUUID();
  const now = new Date();
  const expiresAt = () => new Date(Date.now() + LOCK_TTL_MS);
  try {
    const takenOver = await locks.findOneAndUpdate(
      { _id: LOCK_ID, expiresAt: { $lt: now } },
      { $set: { holder, acquiredAt: now, expiresAt: expiresAt() } },
    );
    if (!takenOver) await locks.insertOne({ _id: LOCK_ID, holder, acquiredAt: now, expiresAt: expiresAt() });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new MigrationError("Another migration run is in progress on this database. Wait for it to finish.");
    }
    throw error;
  }
  return {
    renew: async () => {
      await locks.updateOne({ _id: LOCK_ID, holder }, { $set: { expiresAt: expiresAt() } });
    },
    release: async () => {
      await locks.deleteOne({ _id: LOCK_ID, holder });
    },
  };
}
