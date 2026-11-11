import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In development Vite serves the app on :5173 and passes /api to the API on PORT (npm run dev starts both).
// In production there is no Vite: the API serves the built files (dist/) and /api on one port.
const apiPort = process.env.PORT ?? "3000";
const proxy = { "/api": `http://localhost:${apiPort}` };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  build: { outDir: "dist", emptyOutDir: true },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
  },
});
