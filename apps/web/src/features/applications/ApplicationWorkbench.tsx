import type { ApplicationCheckRun, CreditApplication, OverrideReason, RecommendationOutcome, SimulatedScenario } from "@app/contracts";
import { Alert, Badge, Button, CellStack, DataTable, EmptyState, ErrorState, Field, RunTimeline, Select, Textarea, type Column } from "@app/ui";
import { CheckCircle2, MessageSquareWarning, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useResource } from "../../lib/use-resource.ts";
import { stageLabels, productLabels } from "./application-labels.ts";
import { getApplicationChecks, listApplications, recordRecommendationOverride, runApplicationChecks } from "./applications.api.ts";
import styles from "./ApplicationWorkbench.module.css";

const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

function ageInDays(receivedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86_400_000));
}

const columns: readonly Column<CreditApplication>[] = [
  {
    key: "businessName",
    header: "Business",
    width: "35%",
    render: (application) => <CellStack primary={application.businessName} secondary={<><span lang="ar" dir="rtl">{application.businessNameArabic}</span> · CR {application.commercialRegistration}</>} />,
  },
  { key: "product", header: "Product", width: "22%", hideOnMobile: true, render: (application) => productLabels[application.product] },
  { key: "amountSar", header: "Amount (SAR)", width: "18%", align: "end", hideOnMobile: true, render: (application) => sar.format(application.amountSar) },
  { key: "stage", header: "Stage", width: "18%", render: (application) => <Badge dot tone={stageLabels[application.stage].tone}>{stageLabels[application.stage].label}</Badge> },
  { key: "age", header: "Age", width: "7%", align: "end", hideOnMobile: true, render: (application) => `${ageInDays(application.receivedAt)}d` },
];

export function ApplicationWorkbench() {
  const resource = useResource(listApplications, []);
  const applications = useMemo(() => resource.data?.items ?? [], [resource.data]);
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    if (applications.length && !applications.some((item) => item.id === selectedId)) setSelectedId(applications[0]!.id);
  }, [applications, selectedId]);

  const selected = applications.find((application) => application.id === selectedId);

  return (
    <section className={styles.workbench} aria-labelledby="queue-heading">
      <div className={styles.queuePane}>
        <div className={styles.queueHeading}>
          <div>
            <h1 id="queue-heading">Application queue</h1>
            <p>Oldest applications first</p>
          </div>
          <div className={styles.queueMeta}>
            {resource.data?.sampleData && <Badge tone="neutral">Sample data</Badge>}
            <span>{applications.length} applications</span>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={applications}
          rowKey={(application) => application.id}
          caption="Financing applications, oldest first"
          onRowClick={(application) => setSelectedId(application.id)}
          isRowSelected={(application) => application.id === selectedId}
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          empty={<EmptyState title="No applications in the queue" description="New financing applications will appear here." compact />}
        />
      </div>
      <aside className={styles.casePane} aria-label="Selected application workspace">
        {selected ? <CaseWorkspace application={selected} /> : <div className={styles.noSelection}>Select an application to open its workspace.</div>}
      </aside>
    </section>
  );
}

function CaseWorkspace({ application }: { application: CreditApplication }) {
  const stage = stageLabels[application.stage];
  const checks = useResource((signal) => getApplicationChecks(application.id, signal), [application.id]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string>();
  const [scenario, setScenario] = useState<SimulatedScenario>("clean");

  async function runSpecialists() {
    setRunning(true);
    setRunError(undefined);
    try {
      await runApplicationChecks(application.id, scenario);
      checks.reload();
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The checks could not be run.");
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className={styles.caseContent}>
      <header className={styles.caseHeader}>
        <div>
          <h2>{application.businessName}</h2>
          <p lang="ar" dir="rtl">{application.businessNameArabic}</p>
        </div>
        <Badge dot tone={stage.tone}>{stage.label}</Badge>
      </header>
      <dl className={styles.facts}>
        <div><dt>Commercial Registration</dt><dd className={styles.identifier}>{application.commercialRegistration}</dd></div>
        <div><dt>Location</dt><dd>{application.city}, Saudi Arabia</dd></div>
        <div><dt>Product</dt><dd>{productLabels[application.product]}</dd></div>
        <div><dt>Facility amount</dt><dd className={styles.amount}>{sar.format(application.amountSar)}</dd></div>
        <div><dt>Queue age</dt><dd>{ageInDays(application.receivedAt)} days</dd></div>
        <div><dt>Risk grade</dt><dd>{application.riskGrade ?? "Pending assessment"}</dd></div>
        <div><dt>Annual revenue</dt><dd className={styles.amount}>{application.annualRevenueSar ? sar.format(application.annualRevenueSar) : "Pending evidence"}</dd></div>
        <div><dt>Buyer quality</dt><dd>{application.invoice?.buyerCategory ?? "Not applicable"}</dd></div>
      </dl>
      <section className={styles.checks} aria-labelledby="specialists-heading">
        <div className={styles.checkHeading}>
          <div><h3 id="specialists-heading">Specialist checks</h3><p>SIMAH, Wathq, ZATCA and open-banking sources are simulated.</p></div>
          <div className={styles.runControls}>
            <Field label="Assessment scenario">
              <Select value={scenario} onChange={(event) => setScenario(event.target.value as SimulatedScenario)} options={scenarioOptions} />
            </Field>
            <Button variant="primary" size="sm" icon={<Play size={15} />} loading={running} onClick={runSpecialists}>Run assessment</Button>
          </div>
        </div>
        {runError && <Alert tone="danger" title="Checks not completed">{runError}</Alert>}
        {checks.error ? <ErrorState title="Checks unavailable" message={checks.error} onRetry={checks.reload} compact /> : <CheckLedger applicationId={application.id} run={checks.data?.latest ?? null} loading={checks.loading} onUpdated={checks.reload} />}
      </section>
    </div>
  );
}

const scenarioLabels: Record<SimulatedScenario, string> = { clean: "All checks clear", disputed_invoice: "Disputed invoice", low_bureau: "High-risk bureau score", returned_cheques: "Several returned cheques", ineligible_revenue: "Revenue below policy minimum" };
const scenarioOptions = Object.entries(scenarioLabels).map(([value, label]) => ({ value, label }));
const overrideReasons: OverrideReason[] = ["Additional collateral or guarantee provided", "Information not available to the assessment", "Relationship history with the Bank", "Data quality issue in a source check", "Sector or market conditions"];
const outcomeTones = { Approve: "success", Refer: "warning", Decline: "danger" } as const;

function CheckLedger({ applicationId, run, loading, onUpdated }: { applicationId: string; run: ApplicationCheckRun | null; loading: boolean; onUpdated: () => void }) {
  if (loading) return <p className={styles.checkEmpty}>Loading the latest run…</p>;
  if (!run) return <EmptyState title="No checks run" description="Run the four policy specialists for this application." compact />;
  return (
    <div className={styles.ledger}>
      <div className={styles.runMeta}><Badge tone="neutral">Simulated data</Badge><span>{scenarioLabels[run.scenario]} scenario</span><time dateTime={run.performedAt}>{new Intl.DateTimeFormat("en-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.performedAt))}</time></div>
      <RecommendationPanel applicationId={applicationId} run={run} onUpdated={onUpdated} />
      <section className={styles.review} aria-labelledby="review-heading">
        <h4 id="review-heading"><MessageSquareWarning size={16} /> Reviewer challenge</h4>
        <p className={styles.sectionIntro}>An independent review tests each specialist conclusion before recommendation.</p>
        <div className={styles.challengeList}>{run.recommendation.reviewerChallenges.map((challenge) => <article key={challenge.specialist} className={styles.challenge}>
          <div><strong>{challenge.specialist}</strong><Badge tone={challenge.status === "confirmed" ? "success" : "warning"}>{challenge.status === "confirmed" ? "Confirmed" : "Gap found"}</Badge></div>
          <p>{challenge.conclusion}</p>{challenge.evidenceGap && <span>{challenge.evidenceGap}</span>}
        </article>)}</div>
      </section>
      <h4 className={styles.ledgerHeading}>Specialist evidence</h4>
      <RunTimeline label="Policy specialist check results" steps={run.results.map((result) => ({
        id: result.specialist,
        status: result.outcome === "pass" ? "done" : "failed",
        label: <><span>{result.specialist}</span> <Badge tone={result.outcome === "pass" ? "success" : "warning"}>{result.outcome === "pass" ? "Pass" : "Refer"}</Badge></>,
        meta: result.clause,
        detail: <><p>{result.summary}</p><ul>{result.evidence.map((item) => <li key={item}>{item}</li>)}</ul></>,
      }))} />
    </div>
  );
}

function RecommendationPanel({ applicationId, run, onUpdated }: { applicationId: string; run: ApplicationCheckRun; onUpdated: () => void }) {
  const recommendation = run.recommendation;
  const [outcome, setOutcome] = useState<RecommendationOutcome>(recommendation.outcome === "Approve" ? "Refer" : "Approve");
  const [reason, setReason] = useState<OverrideReason>(overrideReasons[0]);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function saveOverride() {
    setSaving(true); setError(undefined);
    try { await recordRecommendationOverride(applicationId, run.id, { outcome, reason, rationale }); onUpdated(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The override could not be recorded."); }
    finally { setSaving(false); }
  }

  return <section className={styles.recommendation} aria-labelledby="recommendation-heading">
    <div className={styles.decisionLine}>
      <div><h3 id="recommendation-heading">Recommendation</h3><div className={styles.outcome}><Badge dot tone={outcomeTones[recommendation.outcome]}>{recommendation.outcome}</Badge><span>Grade {recommendation.riskGrade} · {recommendation.indicativeProfitRate}</span></div></div>
      <div className={styles.authority}><ShieldCheck size={18} /><div><strong>{recommendation.decisionAuthority}</strong><span>{recommendation.authorityClause}</span></div></div>
    </div>
    <div className={styles.reasonLedger}>{recommendation.reasons.map((item) => <article key={`${item.clause}-${item.conclusion}`}><div><CheckCircle2 size={15} /><strong>{item.conclusion}</strong><Badge tone="neutral">{item.clause}</Badge></div><p>{item.evidence}</p></article>)}</div>
    {recommendation.override ? <div className={styles.recordedOverride}><strong>Analyst override recorded: {recommendation.override.outcome}</strong><p>{recommendation.override.reason} — {recommendation.override.rationale}</p><span>{recommendation.override.recordedBy} · <time dateTime={recommendation.override.recordedAt}>{new Intl.DateTimeFormat("en-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(recommendation.override.recordedAt))}</time></span></div> : <div className={styles.overrideForm}>
      <h4>Analyst override</h4><p>Changing this recommendation is recorded for Credit Risk Committee oversight.</p>
      <div className={styles.overrideFields}><Field label="Override decision"><Select value={outcome} onChange={(event) => setOutcome(event.target.value as RecommendationOutcome)} options={["Approve", "Refer", "Decline"].filter((item) => item !== recommendation.outcome).map((value) => ({ value, label: value }))} /></Field><Field label="Appendix A reason"><Select value={reason} onChange={(event) => setReason(event.target.value as OverrideReason)} options={overrideReasons.map((value) => ({ value, label: value }))} /></Field></div>
      <Field label="Written rationale" hint="Explain the case-specific evidence supporting the override."><Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} /></Field>
      {error && <Alert tone="danger" title="Override not recorded">{error}</Alert>}
      <Button size="sm" loading={saving} disabled={rationale.trim().length < 10} onClick={saveOverride}>Record override</Button>
    </div>}
  </section>;
}
