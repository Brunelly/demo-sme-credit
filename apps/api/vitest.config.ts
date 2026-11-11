import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api",
    environment: "node",
    include: ["test/**/*.test.ts"],
    // One in-memory MongoDB for the whole run (test/global-setup.ts); each test file gets its own database.
    globalSetup: ["test/global-setup.ts"],
    env: { LOG_LEVEL: "silent" },
    // The first run downloads a MongoDB binary, which can take a while.
    hookTimeout: 120_000,
  },
});
