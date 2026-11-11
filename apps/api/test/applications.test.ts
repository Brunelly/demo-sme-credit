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

  it("runs and records all four policy specialists", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "case-1", businessName: "Sample Food Distributor", businessNameArabic: "موزع أغذية تجريبي", commercialRegistration: "1010000099", product: "invoice_financing", amountSar: 1000000, stage: "credit_assessment", receivedAt: new Date(), city: "Riyadh", sampleData: true, invoice: { number: "INV-99", buyerName: "Sample Public Buyer", buyerCategory: "Government", amountSar: 1200000 } });

    const response = await request(testApp(mongo.db, { config: { simulatedDataScenario: "disputed_invoice" } })).post("/api/applications/case-1/checks").send({}).expect(201);

    expect(response.body.scenario).toBe("disputed_invoice");
    expect(response.body.results).toHaveLength(4);
    expect(response.body.results.map((result: { clause: string }) => result.clause)).toEqual(["SME-CP-07 §3.1", "SME-CP-07 §3.2", "SME-CP-07 §3.3", "SME-CP-07 §3.4"]);
    expect(response.body.results.find((result: { specialist: string }) => result.specialist.startsWith("ZATCA"))).toMatchObject({ outcome: "refer" });
    expect((await request(testApp(mongo.db)).get("/api/applications/case-1/checks").expect(200)).body.latest.id).toBe(response.body.id);
  });

  it("changes an outcome when the configured scenario changes", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({ _id: "case-2", businessName: "Sample Logistics", businessNameArabic: "لوجستيات تجريبية", commercialRegistration: "4030000099", product: "working_capital", amountSar: 1000000, stage: "new", receivedAt: new Date(), city: "Jeddah", sampleData: true });
    const clean = await request(testApp(mongo.db, { config: { simulatedDataScenario: "clean" } })).post("/api/applications/case-2/checks").send({}).expect(201);
    const changed = await request(testApp(mongo.db, { config: { simulatedDataScenario: "low_bureau" } })).post("/api/applications/case-2/checks").send({}).expect(201);
    expect(clean.body.results[0].outcome).toBe("pass");
    expect(changed.body.results[0].outcome).toBe("refer");
  });
});
