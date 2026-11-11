import express, { type Express } from "express";
import type { Db } from "mongodb";
import type { AiRunner } from "./ai/maitento.ts";
import type { Config } from "./config.ts";
import type { LongRunningWork } from "./db/long-running.ts";
import { AssistantService } from "./features/assistant/assistant.service.ts";
import { assistantRoutes } from "./features/assistant/assistant.routes.ts";
import { healthRoutes } from "./features/health/health.routes.ts";
import { ApplicationsRepository } from "./features/applications/applications.repository.ts";
import { ApplicationsService } from "./features/applications/applications.service.ts";
import { applicationsRoutes } from "./features/applications/applications.routes.ts";
import { APPLICATION_CHECK_RUNS_COLLECTION, ApplicationChecksRepository } from "./features/applications/application-checks.repository.ts";
import { SimulatedScenarioRepository } from "./features/applications/simulated-scenario.repository.ts";
import { SimulatedSourcesRepository } from "./features/applications/simulated-sources.repository.ts";
import { SettingsService } from "./features/settings/settings.service.ts";
import { settingsRoutes } from "./features/settings/settings.routes.ts";
import { ReviewsRepository } from "./features/reviews/reviews.repository.ts";
import { ReviewsService } from "./features/reviews/reviews.service.ts";
import { reviewsRoutes } from "./features/reviews/reviews.routes.ts";
import { DashboardRepository } from "./features/dashboard/dashboard.repository.ts";
import { DashboardService } from "./features/dashboard/dashboard.service.ts";
import { dashboardRoutes } from "./features/dashboard/dashboard.routes.ts";
import { apiNotFound, errorHandler } from "./http/error-handler.ts";
import { requestLogger } from "./http/request-logger.ts";
import { RESERVED_PREFIX, reservedPaths } from "./http/reserved.ts";
import { webApp } from "./http/web-app.ts";

export interface AppDependencies {
  config: Config;
  db: Db;
  /** Null when Maitento isn't configured: AI features then answer "not connected". */
  ai: AiRunner | null;
  /** Where a feature whose work outlives its request registers it, so a restart never leaves it "running". */
  longRunning: LongRunningWork;
  /** The built web app to serve in production. Defaults to apps/web/dist. */
  webDistDir?: string;
}

/**
 * Builds the Express app. Wiring only: create each feature's repository and service, mount its routes under /api.
 * To add a feature, add its three files under features/<name>/ and mount it here.
 */
export function createApp({ config, db, ai, longRunning, webDistDir }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");

  // First, so nothing else can ever answer a reserved path.
  app.use(RESERVED_PREFIX, reservedPaths);
  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));

  // Each feature: const orders = new OrdersService(new OrdersRepository(db)); then api.use("/orders", ordersRoutes(orders)).
  // Work that outlives its request (a background AI run, an import) also registers its collection, and its service
  // takes `longRunning` to lease each run: longRunning.register({ collection: REPORTS_COLLECTION }). See db/long-running.ts.
  const assistant = new AssistantService(ai);
  const scenarios = new SimulatedScenarioRepository(db, config.simulatedDataScenario);
  const checks = new ApplicationChecksRepository(db);
  const applications = new ApplicationsService(new ApplicationsRepository(db), checks, scenarios, new SimulatedSourcesRepository(db), ai, longRunning);
  longRunning.register({ collection: APPLICATION_CHECK_RUNS_COLLECTION });

  const api = express.Router();
  api.use("/health", healthRoutes(db, ai));
  api.use("/assistant", assistantRoutes(assistant));
  api.use("/applications", applicationsRoutes(applications));
  api.use("/reviews", reviewsRoutes(new ReviewsService(new ReviewsRepository(db))));
  api.use("/dashboard", dashboardRoutes(new DashboardService(new DashboardRepository(db))));
  api.use("/settings", settingsRoutes(new SettingsService(scenarios)));
  api.use(apiNotFound);
  app.use("/api", api);

  if (config.production) {
    const web = webApp(webDistDir);
    if (web) app.use(web);
  }

  app.use(errorHandler);
  return app;
}
