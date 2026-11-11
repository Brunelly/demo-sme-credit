import { MongoMemoryServer } from "mongodb-memory-server-core";
import type { TestProject } from "vitest/node";

// One MongoDB for the whole test run. With TEST_MONGODB_URI set (a MongoDB you already run, e.g. in CI) that one is
// used; otherwise an in-memory server is started. Each test file then works in its own database (test/helpers.ts),
// so files can run in parallel and never see each other's data.

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const external = process.env.TEST_MONGODB_URI;
  if (external) {
    project.provide("mongoUri", external);
    return async () => {};
  }
  const server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
  return async () => {
    await server.stop();
  };
}
