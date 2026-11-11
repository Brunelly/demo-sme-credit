import { createHmac, randomUUID } from "node:crypto";
import type { Express } from "express";
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import type { AiRunner } from "../src/ai/maitento.ts";
import { createApp } from "../src/app.ts";
import { loadConfig, type Config } from "../src/config.ts";
import { ensureIndexes } from "../src/db/indexes.ts";
import { LongRunningWork } from "../src/db/long-running.ts";

/**
 * A database of this test file's own, emptied before each test. Call at the top of a test file:
 *
 *   const mongo = useTestDatabase();
 *   it("…", async () => { await mongo.db.collection("x").insertOne(…) });
 */
export function useTestDatabase(): { readonly db: Db } {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    client = await MongoClient.connect(inject("mongoUri"));
    db = client.db(`test-${randomUUID().slice(0, 8)}`);
  });
  beforeEach(async () => {
    await db.dropDatabase();
    await ensureIndexes(db);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  return {
    get db() {
      return db;
    },
  };
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return { ...loadConfig({}), platformAuthSecret: "test-platform-auth-secret", ...overrides };
}

/** A cryptographically valid but obviously fake platform identity for API tests. */
export function platformToken(profileId: "maha-alotaibi" | "faisal-alqahtani" | "noura-alharbi", subject: string, role: "relationship_manager" | "credit_analyst" | "senior_credit_officer" | "credit_committee" = "credit_analyst"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: subject, profileId, role, iss: "brunelly-platform", aud: "sme-credit-desk", exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
  const signature = createHmac("sha256", "test-platform-auth-secret").update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * The app with a test database and, by default, no AI (as with no MAITENTO_API_KEY). Its long-running work is never
 * started: pass your own `longRunning` and call its check() to test what a restart does to a feature's runs.
 */
export function testApp(
  db: Db,
  options: { ai?: AiRunner | null; config?: Partial<Config>; webDistDir?: string; longRunning?: LongRunningWork } = {},
): Express {
  return createApp({
    config: testConfig(options.config),
    db,
    ai: options.ai ?? null,
    longRunning: options.longRunning ?? new LongRunningWork(db),
    webDistDir: options.webDistDir,
  });
}

/** An AiRunner that answers with `output` (or throws `error`) and records what it was asked. */
export function fakeAi(result: { output?: string; error?: Error } = {}): AiRunner & {
  calls: { name: string; inputs: Record<string, string> }[];
} {
  const calls: { name: string; inputs: Record<string, string> }[] = [];
  return {
    namespace: "test",
    calls,
    async runInteraction(name, inputs) {
      calls.push({ name, inputs });
      if (result.error) throw result.error;
      return { runId: "run-1", output: result.output ?? "" };
    },
  };
}
