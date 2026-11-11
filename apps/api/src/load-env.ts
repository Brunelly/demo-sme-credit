// Local runs: read .env at the repository root, if there is one. Variables already set (by the platform, Docker
// or your shell) always win, so a deployed app never takes a value from a file. Imported first by the entry
// points (server.ts, migrate.ts, scripts/maitento.ts); everything else reads settings through config.ts.
import { existsSync } from "node:fs";
import path from "node:path";

const file = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(file)) process.loadEnvFile(file);
