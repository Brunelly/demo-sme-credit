import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

// Checks on the repository itself: the runner manifest, the env contract and the agent instructions stay
// consistent as the app changes.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const json = (file: string) => JSON.parse(read(file)) as Record<string, unknown>;

interface Manifest {
  commands: Record<string, string>;
  components: { name: string; type: string; public?: boolean; output?: string; servedBy?: string }[];
  health: { path: string };
  env: { name: string }[];
  maitento: { project: string };
  ui?: { viewports: string[]; routes: { path: string; name: string; key?: string }[] };
}

/** A screenshot route's key: its own `key`, or its name in lower case with hyphens (the pipeline derives it the same way). */
const routeKey = (route: { name: string; key?: string }) =>
  route.key ??
  route.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");

describe("poc.json", () => {
  const manifest = json("poc.json") as unknown as Manifest;

  it("matches poc.schema.json", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(json("poc.schema.json"));
    expect(validate(manifest), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("only runs npm scripts that exist", () => {
    const scripts = (json("package.json").scripts ?? {}) as Record<string, string>;
    for (const command of Object.values(manifest.commands)) {
      const script = /^npm (?:run )?(\S+)/.exec(command)?.[1];
      if (script && script !== "ci") expect(scripts, `poc.json runs "${command}"`).toHaveProperty(script);
    }
  });

  it("has exactly one public process, and every static component is served by a process", () => {
    const processes = manifest.components.filter((c) => c.type === "process");
    expect(processes.filter((c) => c.public)).toHaveLength(1);
    for (const component of manifest.components.filter((c) => c.type === "static")) {
      expect(processes.map((p) => p.name)).toContain(component.servedBy);
    }
  });

  it("checks health under /api and points at a Maitento project that exists", () => {
    expect(manifest.health.path.startsWith("/api/")).toBe(true);
    expect(existsSync(path.join(root, manifest.maitento.project))).toBe(true);
  });

  it("names each screenshot route once, with a usable key, and never under /api or /__brunelly", () => {
    const routes = manifest.ui?.routes ?? [];
    expect(routes.length, "poc.json ui.routes").toBeGreaterThan(0);
    const paths = routes.map((route) => route.path);
    expect(new Set(paths).size, "ui.routes paths").toBe(paths.length);
    for (const routePath of paths) expect(routePath, routePath).not.toMatch(/^\/(?:api|__brunelly)(?:\/|$)/);
    const keys = routes.map(routeKey);
    for (const key of keys) expect(key, "ui.routes key").toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(keys).size, "ui.routes keys").toBe(keys.length);
  });

  it("lists the same environment variables as .env.example and the API's config", () => {
    const names = manifest.env.map((variable) => variable.name).sort();
    const example = read(".env.example")
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name))
      .sort();
    expect(example).toEqual(names);
    const config = read("apps/api/src/config.ts");
    for (const name of names) expect(config, `config.ts reads ${name}`).toContain(name);
  });
});

describe("agent instructions", () => {
  it("AGENTS.md and CLAUDE.md say the same thing", () => {
    expect(read("CLAUDE.md")).toEqual(read("AGENTS.md"));
  });
});

describe("migrations", () => {
  it("are numbered files exporting up(db) and never down", () => {
    const dir = path.join(root, "apps/api/migrations");
    // The starter ships none: the folder exists with its README, and every migration a story adds must pass this.
    expect(readdirSync(dir)).toContain("README.md");
    const files = readdirSync(dir).filter((name) => name.endsWith(".ts"));
    for (const file of files) {
      expect(file).toMatch(/^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/);
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, file).toMatch(/export async function up\(/);
      expect(source, file).not.toMatch(/export (async )?function down\(|export const down/);
      expect(source, `${file} must not import the app's code`).not.toMatch(/from ["']\.\.\/src\//);
    }
  });
});
