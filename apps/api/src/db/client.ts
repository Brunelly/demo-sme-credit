import { MongoClient, type Db } from "mongodb";

export interface Database {
  client: MongoClient;
  db: Db;
}

/**
 * Connects to MongoDB. Waits up to 30 s for the server, which covers a database that is still starting next to
 * the app. Call client.close() on shutdown.
 */
export async function connectMongo(uri: string, database: string): Promise<Database> {
  const client = new MongoClient(uri, { appName: "app", serverSelectionTimeoutMS: 30_000 });
  await client.connect();
  return { client, db: client.db(database) };
}

/** Whether a write failed because a unique index already holds the value. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 11000;
}
