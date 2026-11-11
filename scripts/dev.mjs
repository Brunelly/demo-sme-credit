#!/usr/bin/env node
// `npm run dev`: the API (restarts on change) and the web app (Vite, hot reload) together. Open
// http://localhost:5173; Vite passes /api to the API on PORT. Reads .env if there is one. Ctrl+C stops both.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// One command string through the shell, so npm resolves on every platform (npm.cmd on Windows).
const children = ["@app/api", "@app/web"].map((workspace) =>
  spawn(`npm run dev --workspace ${workspace}`, { cwd: root, stdio: "inherit", shell: true }),
);

let exiting = false;
function stop(code) {
  if (exiting) return;
  exiting = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
