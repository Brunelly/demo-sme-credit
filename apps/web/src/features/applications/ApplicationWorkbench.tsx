import type { CreditApplication } from "@app/contracts";
import { Badge, CellStack, DataTable, EmptyState, type Column } from "@app/ui";
import { useEffect, useMemo, useState } from "react";
import { useResource } from "../../lib/use-resource.ts";
import { stageLabels, productLabels } from "./application-labels.ts";
import { listApplications } from "./applications.api.ts";
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
  { key: "amountSar", header: "Amount (SAR)", width: "18%", align: "end", render: (application) => sar.format(application.amountSar) },
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
      </dl>
      <section className={styles.policy} aria-labelledby="authority-heading">
        <h3 id="authority-heading">Decision authority</h3>
        <p>{decisionAuthority(application)}</p>
        <span>SME-CP-07 §7</span>
      </section>
      <section className={styles.checks} aria-labelledby="eligibility-heading">
        <h3 id="eligibility-heading">Eligibility evidence</h3>
        <ul>
          <li>Commercial Registration and operating history</li>
          <li>Revenue and financial statements</li>
          <li>ZATCA registration and screening results</li>
        </ul>
        <span>SME-CP-07 §2</span>
      </section>
    </div>
  );
}
