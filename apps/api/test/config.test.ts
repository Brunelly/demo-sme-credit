import { describe, expect, it } from "vitest";
import { ConfigError, databaseName, loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("runs locally with nothing set", () => {
    expect(loadConfig({})).toEqual({
      production: false,
      port: 3000,
      publicUrl: "http://localhost:3000",
      mongodb: { uri: "mongodb://localhost:27017/app", database: "app" },
      maitento: { baseUrl: undefined, apiKey: undefined, namespace: undefined },
      simulatedDataScenario: "clean",
      platformAuthSecret: undefined,
    });
  });

  it("reads the whole environment contract", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      PORT: "8080",
      PUBLIC_URL: "https://claims.example.com",
      MONGODB_URI: "mongodb://db:27017/claims?retryWrites=true",
      MAITENTO_BASE_URL: "https://api.maitento.com",
      MAITENTO_API_KEY: "user:secret",
      MAITENTO_NAMESPACE: "claims",
      SIMULATED_DATA_SCENARIO: "returned_cheques",
      PLATFORM_AUTH_SECRET: "fake-platform-auth-secret",
    });
    expect(config).toEqual({
      production: true,
      port: 8080,
      publicUrl: "https://claims.example.com",
      mongodb: { uri: "mongodb://db:27017/claims?retryWrites=true", database: "claims" },
      maitento: { baseUrl: "https://api.maitento.com", apiKey: "user:secret", namespace: "claims" },
      simulatedDataScenario: "returned_cheques",
      platformAuthSecret: "fake-platform-auth-secret",
    });
  });

  it("treats empty values as unset", () => {
    expect(loadConfig({ PORT: "", MAITENTO_API_KEY: "  " })).toMatchObject({ port: 3000, maitento: { apiKey: undefined } });
  });

  it("refuses values that can't be right", () => {
    expect(() => loadConfig({ PORT: "eighty" })).toThrow(ConfigError);
    expect(() => loadConfig({ MONGODB_URI: "localhost:27017" })).toThrow(/MONGODB_URI/);
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/Set MONGODB_URI/);
    expect(() => loadConfig({ NODE_ENV: "production", MONGODB_URI: "mongodb://db/app" })).toThrow(/PLATFORM_AUTH_SECRET/);
    expect(() => loadConfig({ SIMULATED_DATA_SCENARIO: "live" })).toThrow(/SIMULATED_DATA_SCENARIO/);
  });
});

describe("databaseName", () => {
  it("is the URI's path, or app", () => {
    expect(databaseName("mongodb://localhost:27017/claims")).toBe("claims");
    expect(databaseName("mongodb+srv://user:pw@cluster.example.net/claims?w=majority")).toBe("claims");
    expect(databaseName("mongodb://a:1,b:2/x")).toBe("x");
    expect(databaseName("mongodb://localhost:27017")).toBe("app");
    expect(databaseName("mongodb://localhost:27017/?replicaSet=rs0")).toBe("app");
  });
});
