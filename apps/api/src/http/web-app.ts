import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Router } from "express";
import { logger } from "../logger.ts";

/** Where `npm run build` puts the web app (apps/web/dist). */
export const WEB_DIST_DIR = path.resolve(import.meta.dirname, "../../../web/dist");

/**
 * Serves the built web app on the API's port (production only), so the whole app is one port and one origin.
 * Hashed files under /assets are cached for a year; every other path that isn't a file gets index.html, so the
 * browser router handles /orders/123 on a refresh. /api and /__brunelly are mounted before this and never reach it.
 */
export function webApp(distDir: string = WEB_DIST_DIR): Router | undefined {
  const indexHtml = path.join(distDir, "index.html");
  if (!existsSync(indexHtml)) {
    logger.warn("web app not built: only the API is served", { distDir });
    return undefined;
  }

  const router = express.Router();
  router.use(
    "/assets",
    express.static(path.join(distDir, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
  );
  router.use(express.static(distDir, { index: false, maxAge: "1h" }));
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
  return router;
}
