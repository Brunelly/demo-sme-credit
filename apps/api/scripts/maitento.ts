// `npm run maitento:validate` / `npm run maitento:deploy`: checks, or deploys, the app's Maitento definitions
// (maitento/ at the repository root) in MAITENTO_NAMESPACE. Validating works with any key; deploying needs a tenant
// admin's key. The platform deploys the definitions on every deploy of the app, so this is for local and
// self-hosted runs. For an offline check with no key at all: `npm run check:maitento` at the root.
import "../src/load-env.ts";
import path from "node:path";
import { Maitento, type BuildResponse } from "@maitento/sdk";

const PROJECT_DIR = path.resolve(import.meta.dirname, "../../../maitento");
const action = process.argv[2];
if (action !== "validate" && action !== "deploy") {
  console.error("Usage: node scripts/maitento.ts validate|deploy");
  process.exit(2);
}

try {
  const mt = new Maitento();
  const result: BuildResponse =
    action === "deploy" ? await mt.deploy(PROJECT_DIR, { throwOnFailure: false }) : await mt.validate(PROJECT_DIR);
  for (const entry of result.log) {
    if (entry.logLevel === "Error" || entry.logLevel === "Warning") {
      console.error(`${entry.logLevel}: ${entry.filename ?? ""}${entry.lineNumber ? `:${entry.lineNumber}` : ""} ${entry.text}`);
    }
  }
  if (!result.isSuccess) {
    console.error(`${action === "deploy" ? "Nothing was deployed" : "Not valid"}: fix the errors above.`);
    process.exit(1);
  }
  console.log(`${action === "deploy" ? "Deployed" : "Valid"}: ${PROJECT_DIR} (namespace ${mt.namespace})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
