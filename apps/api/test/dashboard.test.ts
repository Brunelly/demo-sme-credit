import request from "supertest";
import { describe, expect, it } from "vitest";
import { DashboardRepository } from "../src/features/dashboard/dashboard.repository.ts";
import { DashboardService } from "../src/features/dashboard/dashboard.service.ts";
import { useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

describe("throughput dashboard", () => {
  it("computes weekly applications, turnaround, outcomes and effective overrides from recorded data", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertMany([
      { _id: "app-1", businessName: "Sample Packaging", product: "invoice_financing", amountSar: 1_200_000, receivedAt: new Date("2026-11-09T08:00:00Z"), sampleData: true },
      { _id: "app-2", businessName: "Sample Supplies", product: "working_capital", amountSar: 2_000_000, receivedAt: new Date("2026-11-10T08:00:00Z"), sampleData: true },
      { _id: "older", businessName: "Earlier sample", product: "working_capital", amountSar: 500_000, receivedAt: new Date("2026-11-08T08:00:00Z"), sampleData: true },
    ]);
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertMany([
      { _id: "run-1", applicationId: "app-1", status: "completed", startedAt: "2026-11-09T09:00:00Z", finalRecommendation: { outcome: "Approve" } },
      { _id: "run-2", applicationId: "app-2", status: "completed", startedAt: "2026-11-10T09:00:00Z", finalRecommendation: { outcome: "Approve" } },
    ]);
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("creditDecisions").insertMany([
      { _id: "d-1", applicationId: "app-1", effectiveOutcome: "Approve", recordedAt: "2026-11-10T08:00:00.000Z", status: "final" },
      { _id: "d-2", applicationId: "app-2", effectiveOutcome: "Refer", recordedAt: "2026-11-11T08:00:00.000Z", status: "final" },
      { _id: "pending", applicationId: "app-1", effectiveOutcome: "Decline", recordedAt: "2026-11-11T09:00:00.000Z", status: "awaiting_second_analyst" },
    ]);
    const service = new DashboardService(new DashboardRepository(mongo.db), () => new Date("2026-11-11T12:00:00Z"));
    const result = await service.throughput();
    expect(result).toMatchObject({ applicationsReceived: 2, decisionsCompleted: 2, averageTurnaroundHours: 24, outcomes: { approvals: 1, referrals: 1, declines: 0 }, override: { count: 1, eligibleDecisions: 2, ratePercent: 50 }, sampleData: true });
  });

  it("returns honest empty metrics when no decisions were completed", async () => {
    const service = new DashboardService(new DashboardRepository(mongo.db), () => new Date("2026-11-11T12:00:00Z"));
    expect(await service.throughput()).toMatchObject({ decisionsCompleted: 0, averageTurnaroundHours: null, override: { count: 0, eligibleDecisions: 0, ratePercent: null }, recentDecisions: [] });
  });
});
