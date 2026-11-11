import request from "supertest";
import { describe, expect, it } from "vitest";
import { AI_NOT_CONNECTED, createAiRunner } from "../src/ai/maitento.ts";
import { ASK_ASSISTANT_INTERACTION } from "../src/features/assistant/assistant.service.ts";
import { fakeAi, testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

describe("assistant API without Maitento", () => {
  it("says it isn't connected, and the app still answers", async () => {
    const app = testApp(mongo.db);
    await request(app).get("/api/assistant").expect(200, { connected: false, message: AI_NOT_CONNECTED });
    const response = await request(app).post("/api/assistant/ask").send({ question: "What's urgent?" }).expect(200);
    expect(response.body).toEqual({ status: "not-connected", message: AI_NOT_CONNECTED });
    expect(response.body.message).toMatch(/^AI not connected/);
  });

  it("only connects with both a key and a namespace", () => {
    expect(createAiRunner({ apiKey: undefined, namespace: "app", baseUrl: undefined })).toBeNull();
    expect(createAiRunner({ apiKey: "user:secret", namespace: undefined, baseUrl: undefined })).toBeNull();
    expect(createAiRunner({ apiKey: "not-a-key", namespace: "app", baseUrl: undefined })).toBeNull();
    expect(createAiRunner({ apiKey: "8d0e2f7a-0000-4000-8000-000000000001:secret", namespace: "app", baseUrl: undefined })?.namespace).toBe("app");
  });
});

describe("assistant API with Maitento", () => {
  const answer = JSON.stringify({ answer: "Start with the overdue items.", followUps: ["Which are overdue?"] });

  it("runs the ask-assistant interaction and returns its typed answer", async () => {
    const ai = fakeAi({ output: answer });
    const app = testApp(mongo.db, { ai });

    await request(app).get("/api/assistant").expect(200, { connected: true, message: null });
    const response = await request(app).post("/api/assistant/ask").send({ question: " What's urgent? " }).expect(200);

    expect(response.body).toEqual({ status: "answered", answer: "Start with the overdue items.", followUps: ["Which are overdue?"], runId: "run-1" });
    expect(ai.calls).toEqual([{ name: ASK_ASSISTANT_INTERACTION, inputs: { question: "What's urgent?" } }]);
  });

  it("turns a failed run, or an answer in the wrong shape, into ai_failed", async () => {
    const failed = await request(testApp(mongo.db, { ai: fakeAi({ error: new Error("model key missing") }) }))
      .post("/api/assistant/ask")
      .send({ question: "?" })
      .expect(500);
    expect(failed.body.error).toEqual({ code: "ai_failed", message: expect.stringMatching(/couldn't answer/) });

    const malformed = await request(testApp(mongo.db, { ai: fakeAi({ output: "Sure! Here you go." }) }))
      .post("/api/assistant/ask")
      .send({ question: "?" })
      .expect(500);
    expect(malformed.body.error.code).toBe("ai_failed");
  });

  it("refuses an empty question", async () => {
    const ai = fakeAi({ output: answer });
    await request(testApp(mongo.db, { ai })).post("/api/assistant/ask").send({ question: "  " }).expect(400);
    expect(ai.calls).toHaveLength(0);
  });
});
