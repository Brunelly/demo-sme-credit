import request from "supertest";
import { describe, expect, it } from "vitest";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

describe("applications queue", () => {
  it("returns at most 50 applications with the oldest first", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertMany([
      { _id: "newer", businessName: "Newer", businessNameArabic: "الأحدث", commercialRegistration: "1010000002", product: "working_capital", amountSar: 500000, stage: "new", receivedAt: new Date("2026-11-10T00:00:00Z"), city: "Riyadh", sampleData: true },
      { _id: "older", businessName: "Older", businessNameArabic: "الأقدم", commercialRegistration: "1010000001", product: "invoice_financing", amountSar: 900000, stage: "decision_required", receivedAt: new Date("2026-11-01T00:00:00Z"), city: "Riyadh", sampleData: true },
    ]);

    const response = await request(testApp(mongo.db)).get("/api/applications").expect(200);

    expect(response.body.sampleData).toBe(true);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(["older", "newer"]);
    expect(response.body.items[0]).toMatchObject({ amountSar: 900000, stage: "decision_required" });
  });
});
