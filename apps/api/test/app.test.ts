import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

describe("GET /api/health", () => {
  it("is 200 with the database up", async () => {
    const response = await request(testApp(mongo.db)).get("/api/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok", checks: { database: "up", ai: "not-connected" } });
  });
});

describe("routing", () => {
  it("answers an unknown /api path with a JSON 404", async () => {
    const response = await request(testApp(mongo.db)).get("/api/nothing-here").expect(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("does not expose in-app scenario settings endpoints", async () => {
    await request(testApp(mongo.db)).get("/api/settings/simulated-scenario").expect(404);
    await request(testApp(mongo.db)).put("/api/settings/simulated-scenario").send({ activeScenarioId: "clean" }).expect(404);
  });

  it("never handles /__brunelly/, the platform's reserved path", async () => {
    for (const url of ["/__brunelly", "/__brunelly/", "/__brunelly/auth/callback"]) {
      const response = await request(testApp(mongo.db)).get(url).expect(404);
      expect(response.body.error.code).toBe("reserved_path");
    }
  });
});

describe("serving the web app in production", () => {
  const dist = mkdtempSync(path.join(tmpdir(), "web-dist-"));
  mkdirSync(path.join(dist, "assets"));
  writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(path.join(dist, "assets", "main-abc123.js"), "console.log('app')");
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  const app = () => testApp(mongo.db, { config: { production: true }, webDistDir: dist });

  it("serves index.html for the browser router's paths", async () => {
    for (const url of ["/", "/orders/123", "/kit"]) {
      const response = await request(app()).get(url).expect(200);
      expect(response.text).toContain("<title>app</title>");
    }
  });

  it("serves hashed assets with a long cache, and 404s a missing one instead of sending index.html", async () => {
    const asset = await request(app()).get("/assets/main-abc123.js").expect(200);
    expect(asset.headers["cache-control"]).toContain("immutable");
    await request(app()).get("/assets/gone-999.js").expect(404);
  });

  it("keeps /api and /__brunelly/ ahead of the web app", async () => {
    await request(app()).get("/api/health").expect(200);
    await request(app()).get("/api/nothing-here").expect(404);
    const reserved = await request(app()).get("/__brunelly/start").expect(404);
    expect(reserved.body.error.code).toBe("reserved_path");
  });

  it("doesn't serve the web app outside production", async () => {
    await request(testApp(mongo.db, { webDistDir: dist }))
      .get("/")
      .expect(404);
  });
});
