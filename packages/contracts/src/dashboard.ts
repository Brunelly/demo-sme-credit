export interface ThroughputOutcomeCounts {
  approvals: number;
  referrals: number;
  declines: number;
}

export interface RecentThroughputDecision {
  id: string;
  applicationId: string;
  businessName: string;
  product: "invoice_financing" | "working_capital";
  amountSar: number;
  outcome: "Approve" | "Refer" | "Decline";
  receivedAt: string;
  decidedAt: string;
  turnaroundHours: number;
  overridden: boolean;
}

export interface ThroughputDashboardResponse {
  period: { start: string; end: string; label: string };
  applicationsReceived: number;
  decisionsCompleted: number;
  averageTurnaroundHours: number | null;
  outcomes: ThroughputOutcomeCounts;
  override: { count: number; eligibleDecisions: number; ratePercent: number | null };
  recentDecisions: RecentThroughputDecision[];
  sampleData: boolean;
}
