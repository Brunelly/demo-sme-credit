import { describe, expect, it } from "vitest";
import { askAssistantSchema, simulatedScenarioSchema } from "../src/index.ts";

describe("askAssistantSchema", () => {
  it("needs a question", () => {
    expect(askAssistantSchema.safeParse({ question: "   " }).success).toBe(false);
    expect(askAssistantSchema.parse({ question: " Why? " })).toEqual({ question: "Why?" });
  });

  it("refuses a question over 2,000 characters", () => {
    expect(askAssistantSchema.safeParse({ question: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("simulatedScenarioSchema", () => {
  it("uses the control-centre vocabulary exactly", () => {
    expect(simulatedScenarioSchema.options).toEqual(["clean", "disputed_invoice", "low_bureau", "returned_cheques"]);
    expect(simulatedScenarioSchema.safeParse("ineligible_revenue").success).toBe(false);
  });
});
