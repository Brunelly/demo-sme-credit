// `npm run migrate`: applies the migrations in apps/api/migrations/ that the database (MONGODB_URI) hasn't had.
// The platform runs this on every deploy, before the new version starts; a failure fails the deploy.
import "./load-env.ts";
import { loadConfig } from "./config.ts";
import { connectMongo } from "./db/client.ts";
import { migrate } from "./db/migrations.ts";
import { logger } from "./logger.ts";

const config = loadConfig();
const { client, db } = await connectMongo(config.mongodb.uri, config.mongodb.database);
try {
  const result = await migrate(db, { log: (message) => logger.info(message) });
  logger.info("migrations done", {
    database: config.mongodb.database,
    applied: result.applied,
    alreadyApplied: result.alreadyApplied.length,
  });
} catch (error) {
  logger.error("migration failed", { error });
  process.exitCode = 1;
} finally {
  await client.close();
}
