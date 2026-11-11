import type { RecentThroughputDecision, ThroughputDashboardResponse } from "@app/contracts";
import { Badge, CellStack, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, type Column } from "@app/ui";
import { getThroughputDashboard } from "./dashboard.api.ts";
import { useResource } from "../../lib/use-resource.ts";
import styles from "./ThroughputDashboard.module.css";

const number = new Intl.NumberFormat("en-SA");
const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-SA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Riyadh" });
const outcomeTone = { Approve: "success", Refer: "warning", Decline: "danger" } as const;
const outcomeLabel = { Approve: "Approved", Refer: "Referred", Decline: "Declined" } as const;

function duration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

const columns: readonly Column<RecentThroughputDecision>[] = [
  { key: "application", header: "Application", render: row => <CellStack primary={row.businessName} secondary={row.applicationId.toUpperCase()} /> },
  { key: "amount", header: "Amount", align: "end", render: row => <span className={styles.number}>{sar.format(row.amountSar)}</span>, hideOnMobile: true },
  { key: "outcome", header: "Outcome", render: row => <Badge tone={outcomeTone[row.outcome]}>{outcomeLabel[row.outcome]}</Badge> },
  { key: "turnaround", header: "Turnaround", align: "end", render: row => <span className={styles.number}>{duration(row.turnaroundHours)}</span> },
  { key: "decided", header: "Decided", align: "end", render: row => <time dateTime={row.decidedAt}>{dateTime.format(new Date(row.decidedAt))}</time>, hideOnMobile: true },
];

function Summary({ data }: { data: ThroughputDashboardResponse }) {
  const total = data.decisionsCompleted;
  const parts = [
    { key: "approve", label: "Approved", count: data.outcomes.approvals, className: styles.approved },
    { key: "refer", label: "Referred", count: data.outcomes.referrals, className: styles.referred },
    { key: "decline", label: "Declined", count: data.outcomes.declines, className: styles.declined },
  ];
  return <section className={styles.summary} aria-label="Weekly throughput summary">
    <div className={styles.primaryMetric}><span>Applications received</span><strong>{number.format(data.applicationsReceived)}</strong><small>This week</small></div>
    <div className={styles.primaryMetric}><span>Average decision time</span><strong>{duration(data.averageTurnaroundHours)}</strong><small>{total ? `${number.format(total)} completed decisions` : "No completed decisions"}</small></div>
    <div className={styles.outcomes}>
      <div className={styles.metricTitle}><span>Decision outcomes</span><small>{number.format(total)} total</small></div>
      <div className={styles.bar} aria-label={`${data.outcomes.approvals} approved, ${data.outcomes.referrals} referred, ${data.outcomes.declines} declined`}>
        {parts.filter(part => part.count > 0).map(part => <span key={part.key} className={part.className} style={{ flexGrow: part.count }} />)}
      </div>
      <dl className={styles.legend}>{parts.map(part => <div key={part.key}><dt><i className={part.className} />{part.label}</dt><dd>{number.format(part.count)}</dd></div>)}</dl>
    </div>
    <div className={styles.override}><span>Analyst overrides</span><strong>{data.override.ratePercent === null ? "—" : `${data.override.ratePercent.toFixed(1)}%`}</strong><small>{data.override.count} of {data.override.eligibleDecisions} final decisions</small></div>
  </section>;
}

export function ThroughputDashboard() {
  const resource = useResource(getThroughputDashboard, []);
  if (resource.loading && !resource.data) return <LoadingState label="Loading team throughput" />;
  if (resource.error && !resource.data) return <ErrorState title="Throughput could not be loaded" message={resource.error} onRetry={resource.reload} />;
  const data = resource.data!;
  return <main className={styles.page}>
    <PageHeader title="Team throughput" description="Applications and final credit decisions recorded this week" />
    <div className={styles.period}><span>{data.period.label}</span><time dateTime={data.period.start}>{new Intl.DateTimeFormat("en-SA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(data.period.start))}</time><span aria-hidden="true">–</span><time dateTime={data.period.end}>{new Intl.DateTimeFormat("en-SA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(new Date(data.period.end).getTime() - 1))}</time>{data.sampleData && <Badge tone="neutral">Sample data</Badge>}</div>
    <Summary data={data} />
    <section className={styles.decisions} aria-labelledby="recent-decisions-heading">
      <div className={styles.sectionHeading}><div><h2 id="recent-decisions-heading">Recent final decisions</h2><p>The records behind this week’s outcome and turnaround figures.</p></div><span>{number.format(data.decisionsCompleted)} completed</span></div>
      <DataTable columns={columns} rows={data.recentDecisions} rowKey={row => row.id} caption="Recent final credit decisions" empty={<EmptyState title="No final decisions this week" description="Outcome, turnaround and override metrics will appear when analysts complete a decision." compact />} />
    </section>
  </main>;
}
