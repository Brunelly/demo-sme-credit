import { defineConfig } from "vitest/config";

// `npm test` runs every workspace's tests (each has its own vitest.config.ts) and the repository's own checks in
// tests/, in one run.
export default defineConfig({
  test: {
    projects: [
      "apps/*",
      "packages/*",
      { test: { name: "repo", environment: "node", include: ["tests/**/*.test.ts"] } },
    ],
  },
});
