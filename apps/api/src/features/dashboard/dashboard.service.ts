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
      this.repository.summarizeFinalDecisions(start, end),
      this.repository.isSampleData(),
    ]);
    const outcomes = {
      approvals: decisions.approvals,
      referrals: decisions.referrals,
      declines: decisions.declines,
    };
    return {
      period: { start: start.toISOString(), end: end.toISOString(), label: "This week · Monday to Sunday" },
      applicationsReceived,
      decisionsCompleted: decisions.decisionsCompleted,
      averageTurnaroundHours: decisions.averageTurnaroundHours,
      outcomes,
      override: { count: decisions.overrideCount, eligibleDecisions: decisions.decisionsCompleted, ratePercent: decisions.decisionsCompleted ? decisions.overrideCount / decisions.decisionsCompleted * 100 : null },
      recentDecisions: decisions.recentDecisions,
      sampleData,
    };
  }
}
