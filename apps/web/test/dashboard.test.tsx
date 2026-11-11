import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi, renderAt } from "./helpers.tsx";

const response = {
  period: { start: "2026-11-09T00:00:00.000Z", end: "2026-11-16T00:00:00.000Z", label: "This week · Monday to Sunday" },
  applicationsReceived: 4,
  decisionsCompleted: 3,
  averageTurnaroundHours: 28,
  outcomes: { approvals: 1, referrals: 1, declines: 1 },
  override: { count: 1, eligibleDecisions: 3, ratePercent: 33.333 },
  recentDecisions: [{ id: "decision-1", applicationId: "app-1029", businessName: "Sample Clinical Supplies", product: "invoice_financing", amountSar: 2_250_000, outcome: "Refer", receivedAt: "2026-11-10T10:10:00.000Z", decidedAt: "2026-11-11T10:40:00.000Z", turnaroundHours: 24.5, overridden: true }],
  sampleData: true,
};

describe("team throughput dashboard", () => {
  it("shows computed weekly metrics, outcome counts, override denominator and source decisions", async () => {
    mockApi({ "GET /api/dashboard/throughput": () => response });
    renderAt("/dashboard");
    expect(await screen.findByRole("heading", { level: 1, name: "Team throughput" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Weekly throughput summary" });
    expect(summary).toHaveTextContent("Applications received4");
    expect(summary).toHaveTextContent("Average decision time1.2 d");
    expect(summary).toHaveTextContent("Approved1");
    expect(summary).toHaveTextContent("Referred1");
    expect(summary).toHaveTextContent("Declined1");
    expect(summary).toHaveTextContent("33.3%1 of 3 final decisions");
    expect(screen.getByRole("table", { name: "Recent final credit decisions" })).toHaveTextContent("Sample Clinical Supplies");
  });

  it("explains empty decision metrics without inventing a value", async () => {
    mockApi({ "GET /api/dashboard/throughput": () => ({ ...response, decisionsCompleted: 0, averageTurnaroundHours: null, outcomes: { approvals: 0, referrals: 0, declines: 0 }, override: { count: 0, eligibleDecisions: 0, ratePercent: null }, recentDecisions: [] }) });
    renderAt("/dashboard");
    expect(await screen.findByText("No final decisions this week")).toBeInTheDocument();
    expect(screen.getByText("No completed decisions")).toBeInTheDocument();
  });
});
