import { z } from "zod";
import type { SimulatedScenario } from "@app/contracts";

// The environment contract (see .env.example). This is the ONLY place the app reads process.env (logger.ts reads
// LOG_LEVEL itself, before a Config exists): everything else takes a Config. Add a new setting here, to .env.example
// and to poc.json's "env" list together, with a description, and `secret: true` for a credential (never a default).
// People set the values in the platform's settings: never put a secret's value in the repository, tests included.

const DEFAULT_MONGODB_URI = "mongodb://localhost:27017/app";
const DEFAULT_DATABASE = "app";

/** An unset or empty variable is "not set". */
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: optionalText,
  PORT: optionalText.transform((value) => (value === undefined ? 3000 : Number(value))).pipe(z.number().int().min(1).max(65_535)),
  PUBLIC_URL: optionalText.pipe(z.url().optional()),
  MONGODB_URI: optionalText.pipe(z.string().regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb://").optional()),
  MAITENTO_BASE_URL: optionalText.pipe(z.url().optional()),
  MAITENTO_API_KEY: optionalText,
  MAITENTO_NAMESPACE: optionalText,
  SIMULATED_DATA_SCENARIO: optionalText.pipe(z.enum(["clean", "disputed_invoice", "low_bureau", "returned_cheques"]).optional()),
  PLATFORM_AUTH_SECRET: optionalText,
});

export interface Config {
  /** True when NODE_ENV is "production": the API then also serves the built web app. */
  production: boolean;
  port: number;
  /** Where people open the app. Use it for absolute links. */
  publicUrl: string;
  mongodb: { uri: string; database: string };
  maitento: { baseUrl: string | undefined; apiKey: string | undefined; namespace: string | undefined };
  simulatedDataScenario: SimulatedScenario;
  /** Verifies the platform-issued bearer identity used for credit decisions. */
  platformAuthSecret: string | undefined;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new ConfigError(`The environment is not valid: ${problems.join("; ")}`);
  }
  const values = parsed.data;
  const production = values.NODE_ENV === "production";
  if (production && !values.MONGODB_URI) throw new ConfigError("Set MONGODB_URI: production has no default database.");
  if (production && !values.PLATFORM_AUTH_SECRET) throw new ConfigError("Set PLATFORM_AUTH_SECRET: production decision routes require verified platform identities.");

  const uri = values.MONGODB_URI ?? DEFAULT_MONGODB_URI;
  return {
    production,
    port: values.PORT,
    publicUrl: values.PUBLIC_URL ?? `http://localhost:${values.PORT}`,
    mongodb: { uri, database: databaseName(uri) },
    maitento: {
      baseUrl: values.MAITENTO_BASE_URL,
      apiKey: values.MAITENTO_API_KEY,
      namespace: values.MAITENTO_NAMESPACE,
    },
    simulatedDataScenario: values.SIMULATED_DATA_SCENARIO ?? "clean",
    platformAuthSecret: values.PLATFORM_AUTH_SECRET,
  };
}

/** The database is the URI's path: mongodb://host:27017/<database>?options. "app" when it has none. */
export function databaseName(uri: string): string {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);
  return match?.[1] ? decodeURIComponent(match[1]) : DEFAULT_DATABASE;
}
