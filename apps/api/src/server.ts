// The app's entry point: read the environment, connect to MongoDB, create the indexes, take over the long-running
// work a previous process left behind, listen on PORT. Migrations are NOT run here: `npm run migrate` runs them
// before the app starts (the platform does this on every deploy). Started by `npm run dev` (watching) and `npm start`.
import "./load-env.ts";
import { createAiRunner } from "./ai/maitento.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { connectMongo } from "./db/client.ts";
import { ensureIndexes } from "./db/indexes.ts";
import { LongRunningWork } from "./db/long-running.ts";
import { logger } from "./logger.ts";

const SHUTDOWN_GRACE_MS = 10_000;

const config = loadConfig();
const { client, db } = await connectMongo(config.mongodb.uri, config.mongodb.database);
await ensureIndexes(db);
const ai = createAiRunner(config.maitento);
const longRunning = new LongRunningWork(db);
const app = createApp({ config, db, ai, longRunning });
// Before taking traffic: work still "running" from a previous process (a restart, a crash, or the previous
// version, whose database this one starts on a copy of) is resumed or marked interrupted. See db/long-running.ts.
await longRunning.start();

const server = app.listen(config.port, () => {
  logger.info("listening", {
    port: config.port,
    publicUrl: config.publicUrl,
    database: config.mongodb.database,
    ai: ai ? `connected (${ai.namespace})` : "not connected",
    servesWebApp: config.production,
  });
});
server.on("error", (error) => {
  logger.error("could not listen", { port: config.port, error });
  process.exit(1);
});

// The platform stops the old version with SIGTERM after a deploy: finish what's in flight, then exit.
let stopping = false;
function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  logger.info("shutting down", { signal });
  setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
  server.close(() => {
    void longRunning
      .stop()
      .catch((error: unknown) => logger.warn("could not end the leases of long-running work", { error }))
      .finally(() => client.close())
      .finally(() => process.exit(0));
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
