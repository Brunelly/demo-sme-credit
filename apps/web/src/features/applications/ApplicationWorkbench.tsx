import type { ApplicationCheckRun, CreditApplication, SimulatedScenario } from "@app/contracts";
import { Alert, Badge, Button, CellStack, DataTable, EmptyState, ErrorState, RunTimeline, type Column } from "@app/ui";
import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useResource } from "../../lib/use-resource.ts";
import { stageLabels, productLabels } from "./application-labels.ts";
import { getApplicationChecks, listApplications, runApplicationChecks } from "./applications.api.ts";
import styles from "./ApplicationWorkbench.module.css";

const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

function ageInDays(receivedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86_400_000));
}

function decisionAuthority(application: CreditApplication): string {
  if (application.stage === "referred") return "Credit analyst reviews flagged checks";
  if (application.amountSar > 5_000_000 || application.riskGrade === "D") return "Credit committee";
  if (application.amountSar > 2_000_000) return "Senior credit officer";
  return "Credit analyst confirms when all checks are green";
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

  async function runSpecialists() {
    setRunning(true);
    setRunError(undefined);
    try {
      await runApplicationChecks(application.id);
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
      <section className={styles.policy} aria-labelledby="authority-heading">
        <h3 id="authority-heading">Decision authority</h3>
        <p>{decisionAuthority(application)}</p>
        <span>SME-CP-07 §7</span>
      </section>
      <section className={styles.checks} aria-labelledby="specialists-heading">
        <div className={styles.checkHeading}>
          <div><h3 id="specialists-heading">Specialist checks</h3><p>SIMAH, Wathq, ZATCA and open-banking sources are simulated.</p></div>
          <Button variant="primary" size="sm" icon={<Play size={15} />} loading={running} onClick={runSpecialists}>Run four checks</Button>
        </div>
        {runError && <Alert tone="danger" title="Checks not completed">{runError}</Alert>}
        {checks.error ? <ErrorState title="Checks unavailable" message={checks.error} onRetry={checks.reload} compact /> : <CheckLedger run={checks.data?.latest ?? null} loading={checks.loading} />}
      </section>
    </div>
  );
}

const scenarioLabels: Record<SimulatedScenario, string> = { clean: "Clean", disputed_invoice: "Disputed invoice", low_bureau: "Low bureau", returned_cheques: "Several returned cheques" };

function CheckLedger({ run, loading }: { run: ApplicationCheckRun | null; loading: boolean }) {
  if (loading) return <p className={styles.checkEmpty}>Loading the latest run…</p>;
  if (!run) return <EmptyState title="No checks run" description="Run the four policy specialists for this application." compact />;
  return (
    <div className={styles.ledger}>
      <div className={styles.runMeta}><Badge tone="neutral">Simulated data</Badge><span>{scenarioLabels[run.scenario]} scenario</span><time dateTime={run.performedAt}>{new Intl.DateTimeFormat("en-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.performedAt))}</time></div>
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
