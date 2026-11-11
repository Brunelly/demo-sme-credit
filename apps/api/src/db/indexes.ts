import type { Db, IndexDescription } from "mongodb";
import { logger } from "../logger.ts";
import { APPLICATIONS_COLLECTION, applicationIndexes } from "../features/applications/applications.repository.ts";
import { APPLICATION_CHECK_RUNS_COLLECTION, applicationCheckRunIndexes } from "../features/applications/application-checks.repository.ts";
import { SIMULATED_SCENARIO_SETTINGS_COLLECTION, simulatedScenarioIndexes } from "../features/applications/simulated-scenario.repository.ts";
import { SIMULATED_SOURCES_COLLECTION, simulatedSourceIndexes } from "../features/applications/simulated-sources.repository.ts";
import { DECISIONS_COLLECTION, decisionIndexes } from "../features/reviews/reviews.repository.ts";

/**
 * Every index the app needs, by collection. INDEXES ARE CODE, NOT MIGRATIONS: each repository declares the indexes
 * its queries use, lists them here, and the app creates them when it starts (server.ts). Every query needs an
 * index: when you add a query, add its index in the same change.
 *
 * Give every index a `name`. To change one, change it here: on start, an index whose options changed is dropped
 * and created again. Removing one from this list leaves it in the database. A collection registered as long-running
 * work also gets the lease index (LEASE_INDEX), from db/long-running.ts: don't list that one here.
 */
// e.g. [ORDERS_COLLECTION]: orderIndexes, with the array exported from features/orders/orders.repository.ts.
export const INDEXES: Record<string, IndexDescription[]> = {
  [APPLICATIONS_COLLECTION]: applicationIndexes,
  [APPLICATION_CHECK_RUNS_COLLECTION]: applicationCheckRunIndexes,
  [SIMULATED_SCENARIO_SETTINGS_COLLECTION]: simulatedScenarioIndexes,
  [SIMULATED_SOURCES_COLLECTION]: simulatedSourceIndexes,
  [DECISIONS_COLLECTION]: decisionIndexes,
};

/** MongoDB's codes for "an index with this name or these keys already exists, with other options". */
const INDEX_CONFLICT_CODES = new Set([85, 86]);

export async function ensureIndexes(db: Db, indexes: Record<string, IndexDescription[]> = INDEXES): Promise<void> {
  for (const [collectionName, descriptions] of Object.entries(indexes)) {
    const collection = db.collection(collectionName);
    for (const description of descriptions) {
      if (!description.name) throw new Error(`An index on ${collectionName} has no name: name every index.`);
      const { key, ...options } = description;
      try {
        await collection.createIndex(key, options);
      } catch (error) {
        if (!INDEX_CONFLICT_CODES.has((error as { code?: number }).code ?? 0)) throw error;
        logger.info("index changed: recreating it", { collection: collectionName, index: description.name });
        await dropConflicting(db, collectionName, description);
        await collection.createIndex(key, options);
      }
    }
  }
}

/** Drops the existing index that has this one's name or keys. */
async function dropConflicting(db: Db, collectionName: string, description: IndexDescription): Promise<void> {
  const collection = db.collection(collectionName);
  const wanted = JSON.stringify(description.key);
  for (const existing of await collection.indexes()) {
    if (existing.name === "_id_") continue;
    if (existing.name === description.name || JSON.stringify(existing.key) === wanted) {
      await collection.dropIndex(existing.name!);
    }
  }
}
