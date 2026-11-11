import type { ThroughputDashboardResponse } from "@app/contracts";
import type { DashboardRepository } from "./dashboard.repository.ts";

function weekBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export class DashboardService {
  private readonly repository: DashboardRepository;
  private readonly now: () => Date;
  constructor(repository: DashboardRepository, now: () => Date = () => new Date()) { this.repository = repository; this.now = now; }

  async throughput(): Promise<ThroughputDashboardResponse> {
    const { start, end } = weekBounds(this.now());
    const [applicationsReceived, decisions, sampleData] = await Promise.all([
      this.repository.countApplications(start, end),
      this.repository.listFinalDecisions(start, end),
      this.repository.isSampleData(),
    ]);
    const outcomes = {
      approvals: decisions.filter((item) => item.outcome === "Approve").length,
      referrals: decisions.filter((item) => item.outcome === "Refer").length,
      declines: decisions.filter((item) => item.outcome === "Decline").length,
    };
    const overrideCount = decisions.filter((item) => item.overridden).length;
    const average = decisions.length ? decisions.reduce((sum, item) => sum + item.turnaroundHours, 0) / decisions.length : null;
    return {
      period: { start: start.toISOString(), end: end.toISOString(), label: "This week · Monday to Sunday" },
      applicationsReceived,
      decisionsCompleted: decisions.length,
      averageTurnaroundHours: average,
      outcomes,
      override: { count: overrideCount, eligibleDecisions: decisions.length, ratePercent: decisions.length ? overrideCount / decisions.length * 100 : null },
      recentDecisions: decisions.slice(0, 8),
      sampleData,
    };
  }
}
