import type { RecentThroughputDecision, ThroughputDashboardResponse } from "@app/contracts";
import { Badge, CellStack, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, type Column } from "@app/ui";
import { getThroughputDashboard } from "./dashboard.api.ts";
import { useResource } from "../../lib/use-resource.ts";
import { usePreferences, type Locale } from "../../lib/preferences.tsx";
import styles from "./ThroughputDashboard.module.css";

const outcomeTone = { Approve: "success", Refer: "warning", Decline: "danger" } as const;
const copy = {
  en: {
    title: "Team throughput", description: "Applications and final credit decisions recorded this week",
    period: "This week · Monday to Sunday", sample: "Sample data", summary: "Weekly throughput summary",
    received: "Applications received", thisWeek: "This week", average: "Average decision time",
    completedDecisions: (count: string) => `${count} completed decisions`, noCompleted: "No completed decisions",
    outcomes: "Decision outcomes", total: (count: string) => `${count} total`, approved: "Approved", referred: "Referred", declined: "Declined",
    outcomeSummary: (approved: string, referred: string, declined: string) => `${approved} approved, ${referred} referred, ${declined} declined`,
    overrides: "Analyst overrides", overrideDetail: (count: string, eligible: string) => `${count} of ${eligible} final decisions`,
    application: "Application", amount: "Amount", outcome: "Outcome", turnaround: "Turnaround", decided: "Decided",
    recent: "Recent final decisions", recentDescription: "The records behind this week’s outcome and turnaround figures.",
    completed: (count: string) => `${count} completed`, caption: "Recent final credit decisions",
    emptyTitle: "No final decisions this week", emptyDescription: "Outcome, turnaround and override metrics will appear when analysts complete a decision.",
    loading: "Loading team throughput", errorTitle: "Throughput could not be loaded", errorMessage: "The dashboard data is unavailable. Try again.", retry: "Try again",
    hours: "h", days: "d",
  },
  ar: {
    title: "إنتاجية الفريق", description: "الطلبات وقرارات الائتمان النهائية المسجلة هذا الأسبوع",
    period: "هذا الأسبوع · من الاثنين إلى الأحد", sample: "بيانات تجريبية", summary: "ملخص إنتاجية هذا الأسبوع",
    received: "الطلبات المستلمة", thisWeek: "هذا الأسبوع", average: "متوسط وقت اتخاذ القرار",
    completedDecisions: (count: string) => `${count} قرارات مكتملة`, noCompleted: "لا توجد قرارات مكتملة",
    outcomes: "نتائج القرارات", total: (count: string) => `${count} إجمالي`, approved: "موافقة", referred: "إحالة", declined: "رفض",
    outcomeSummary: (approved: string, referred: string, declined: string) => `${approved} موافقة، ${referred} إحالة، ${declined} رفض`,
    overrides: "تعديلات المحللين", overrideDetail: (count: string, eligible: string) => `${count} من ${eligible} قرارات نهائية`,
    application: "الطلب", amount: "المبلغ", outcome: "النتيجة", turnaround: "مدة اتخاذ القرار", decided: "تاريخ القرار",
    recent: "أحدث القرارات النهائية", recentDescription: "السجلات التي تستند إليها نتائج هذا الأسبوع ومدد اتخاذ القرار.",
    completed: (count: string) => `${count} مكتملة`, caption: "أحدث قرارات الائتمان النهائية",
    emptyTitle: "لا توجد قرارات نهائية هذا الأسبوع", emptyDescription: "ستظهر مقاييس النتائج ومدة اتخاذ القرار والتعديلات عند إكمال المحللين للقرارات.",
    loading: "جارٍ تحميل إنتاجية الفريق", errorTitle: "تعذر تحميل إنتاجية الفريق", errorMessage: "بيانات لوحة المعلومات غير متاحة. أعد المحاولة.", retry: "أعد المحاولة",
    hours: "ساعة", days: "أيام",
  },
} as const;

function duration(hours: number | null, locale: Locale, format: Intl.NumberFormat): string {
  if (hours === null) return "—";
  const value = hours < 24 ? hours : hours / 24;
  const rounded = hours < 24 && hours >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${format.format(rounded)} ${hours < 24 ? copy[locale].hours : copy[locale].days}`;
}

function Summary({ data, locale, number, durationNumber }: { data: ThroughputDashboardResponse; locale: Locale; number: Intl.NumberFormat; durationNumber: Intl.NumberFormat }) {
  const text = copy[locale];
  const total = data.decisionsCompleted;
  const parts = [
    { key: "approve", label: text.approved, count: data.outcomes.approvals, className: styles.approved },
    { key: "refer", label: text.referred, count: data.outcomes.referrals, className: styles.referred },
    { key: "decline", label: text.declined, count: data.outcomes.declines, className: styles.declined },
  ];
  return <section className={styles.summary} aria-label={text.summary}>
    <div className={styles.primaryMetric}><span>{text.received}</span><strong>{number.format(data.applicationsReceived)}</strong><small>{text.thisWeek}</small></div>
    <div className={styles.primaryMetric}><span>{text.average}</span><strong>{duration(data.averageTurnaroundHours, locale, durationNumber)}</strong><small>{total ? text.completedDecisions(number.format(total)) : text.noCompleted}</small></div>
    <div className={styles.outcomes}>
      <div className={styles.metricTitle}><span>{text.outcomes}</span><small>{text.total(number.format(total))}</small></div>
      <div className={styles.bar} aria-label={text.outcomeSummary(number.format(data.outcomes.approvals), number.format(data.outcomes.referrals), number.format(data.outcomes.declines))}>
        {parts.filter(part => part.count > 0).map(part => <span key={part.key} className={part.className} style={{ flexGrow: part.count }} />)}
      </div>
      <dl className={styles.legend}>{parts.map(part => <div key={part.key}><dt><i className={part.className} />{part.label}</dt><dd>{number.format(part.count)}</dd></div>)}</dl>
    </div>
    <div className={styles.override}><span>{text.overrides}</span><strong>{data.override.ratePercent === null ? "—" : `${durationNumber.format(data.override.ratePercent)}%`}</strong><small>{text.overrideDetail(number.format(data.override.count), number.format(data.override.eligibleDecisions))}</small></div>
  </section>;
}

export function ThroughputDashboard() {
  const { locale } = usePreferences();
  const text = copy[locale];
  const intlLocale = locale === "ar" ? "ar-SA" : "en-SA";
  const number = new Intl.NumberFormat(intlLocale);
  const durationNumber = new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const sar = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
  const dateTime = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Riyadh" });
  const periodDate = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", timeZone: "UTC" });
  const outcomeLabel = { Approve: text.approved, Refer: text.referred, Decline: text.declined };
  const columns: readonly Column<RecentThroughputDecision>[] = [
    { key: "application", header: text.application, render: row => <CellStack primary={<bdi>{row.businessName}</bdi>} secondary={<bdi>{row.applicationId.toUpperCase()}</bdi>} /> },
    { key: "amount", header: text.amount, align: "end", render: row => <bdi className={styles.number}>{sar.format(row.amountSar)}</bdi>, hideOnMobile: true },
    { key: "outcome", header: text.outcome, render: row => <Badge tone={outcomeTone[row.outcome]}>{outcomeLabel[row.outcome]}</Badge> },
    { key: "turnaround", header: text.turnaround, align: "end", render: row => <span className={styles.number}>{duration(row.turnaroundHours, locale, durationNumber)}</span> },
    { key: "decided", header: text.decided, align: "end", render: row => <time dateTime={row.decidedAt}>{dateTime.format(new Date(row.decidedAt))}</time>, hideOnMobile: true },
  ];
  const resource = useResource(getThroughputDashboard, []);
  if (resource.loading && !resource.data) return <LoadingState label={text.loading} />;
  if (resource.error && !resource.data) return <ErrorState title={text.errorTitle} message={locale === "ar" ? text.errorMessage : resource.error} onRetry={resource.reload} retryLabel={text.retry} />;
  const data = resource.data!;
  return <main className={styles.page}>
    <PageHeader title={text.title} description={text.description} />
    <div className={styles.period}><span>{text.period}</span><time dateTime={data.period.start}>{periodDate.format(new Date(data.period.start))}</time><span aria-hidden="true">–</span><time dateTime={data.period.end}>{periodDate.format(new Date(new Date(data.period.end).getTime() - 1))}</time>{data.sampleData && <Badge tone="neutral">{text.sample}</Badge>}</div>
    <Summary data={data} locale={locale} number={number} durationNumber={durationNumber} />
    <section className={styles.decisions} aria-labelledby="recent-decisions-heading">
      <div className={styles.sectionHeading}><div><h2 id="recent-decisions-heading">{text.recent}</h2><p>{text.recentDescription}</p></div><span>{text.completed(number.format(data.decisionsCompleted))}</span></div>
      <DataTable columns={columns} rows={data.recentDecisions} rowKey={row => row.id} caption={text.caption} empty={<EmptyState title={text.emptyTitle} description={text.emptyDescription} compact />} />
    </section>
  </main>;
}
