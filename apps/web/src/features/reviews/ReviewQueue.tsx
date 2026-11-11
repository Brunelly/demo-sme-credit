import { useEffect, useState } from "react";
import type { AnalystDecision, OverrideReason, ReviewQueueItem } from "@app/contracts";
import { Alert, Badge, Button, CellStack, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Select, Textarea } from "@app/ui";
import { Check, CornerUpRight, ShieldCheck, ThumbsDown } from "lucide-react";
import { errorMessage } from "../../lib/api.ts";
import { getReviewQueue, recordDecision } from "./reviews.api.ts";
import styles from "./ReviewQueue.module.css";

const overrideReasons: OverrideReason[] = ["Additional collateral or guarantee provided", "Information not available to the assessment", "Relationship history with the Bank", "Data quality issue in a source check", "Sector or market conditions"];
const money = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

export function ReviewQueue() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]); const [selectedId, setSelectedId] = useState<string>(); const [sampleData, setSampleData] = useState(false);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState<string>();
  const [decision, setDecision] = useState<AnalystDecision>("approve"); const [analystName, setAnalystName] = useState("");
  const [notes, setNotes] = useState(""); const [overrideReason, setOverrideReason] = useState<OverrideReason>(overrideReasons[0]);
  const [overrideOutcome, setOverrideOutcome] = useState<"Approve" | "Refer" | "Decline">("Approve"); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState<string>();
  const selected = items.find((item) => item.application.id === selectedId) ?? items[0];
  async function load() { setLoading(true); setLoadError(undefined); try { const result = await getReviewQueue(); setItems(result.items); setSampleData(result.sampleData); setSelectedId((current) => result.items.some((item) => item.application.id === current) ? current : result.items[0]?.application.id); } catch (error) { setLoadError(errorMessage(error)); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!selected) return; setDecision(selected.queueStatus === "awaiting_second_analyst" ? "decline" : selected.recommendation.outcome.toLocaleLowerCase() as "approve" | "refer" | "decline"); }, [selected?.application.id, selected?.queueStatus, selected?.recommendation.outcome]);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!selected) return; setSaving(true); setFormError(undefined); try { await recordDecision(selected.application.id, { analystName, decision, notes, ...(decision === "override" ? { overrideReason, overrideOutcome } : {}) }); setNotes(""); await load(); } catch (error) { setFormError(errorMessage(error)); } finally { setSaving(false); } }
  const columns = [
    { key: "case", header: "Case", render: (item: ReviewQueueItem) => <CellStack primary={item.application.businessName} secondary={item.application.id.toUpperCase()} /> },
    { key: "amount", header: "Amount", align: "end" as const, render: (item: ReviewQueueItem) => <span className={styles.number}>{money.format(item.application.amountSar)}</span> },
    { key: "recommendation", header: "AI recommendation", render: (item: ReviewQueueItem) => <Badge tone={item.recommendation.outcome === "Approve" ? "success" : item.recommendation.outcome === "Decline" ? "danger" : "warning"}>{item.recommendation.outcome}</Badge> },
    { key: "grade", header: "Grade", align: "center" as const, render: (item: ReviewQueueItem) => item.recommendation.riskGrade ?? "—", hideOnMobile: true },
    { key: "authority", header: "Required authority", render: (item: ReviewQueueItem) => item.authority, hideOnMobile: true },
  ];
  return <div className={styles.page}>
    <PageHeader title="Analyst review queue" description="Decide each recommendation under SME-CP-07 §7.1. Every action is written to the decision ledger." />
    {sampleData && <Alert tone="info" title="Sample review data">These cases are illustrative and labelled for the demonstration.</Alert>}
    <div className={styles.queueBar}><strong>{items.length} awaiting review</strong><span>Oldest received first</span></div>
    <div className={styles.workbench}>
      <section className={styles.list} aria-label="Cases awaiting decision"><DataTable columns={columns} rows={items} rowKey={(item) => item.application.id} caption="Cases awaiting an analyst decision" loading={loading} error={loadError} onRetry={load} onRowClick={(item) => setSelectedId(item.application.id)} isRowSelected={(item) => item.application.id === selected?.application.id} empty={<EmptyState title="No cases awaiting review" description="New recommendations will appear here when they require a human decision." compact />} /></section>
      {loadError ? null : selected ? <section className={styles.detail} aria-label={`Decision for ${selected.application.businessName}`}>
        <div className={styles.caseHeader}><div><h2>{selected.application.businessName}</h2><p>{selected.application.id.toUpperCase()} · CR {selected.application.commercialRegistration}</p></div><Badge tone={selected.queueStatus === "awaiting_second_analyst" ? "warning" : "neutral"}>{selected.queueStatus === "awaiting_second_analyst" ? "Second analyst required" : "Decision required"}</Badge></div>
        <dl className={styles.facts}><div><dt>Facility</dt><dd>{money.format(selected.application.amountSar)}</dd></div><div><dt>Risk grade</dt><dd>{selected.recommendation.riskGrade ?? "Not assigned"}</dd></div><div><dt>AI recommendation</dt><dd>{selected.recommendation.outcome}</dd></div><div><dt>Who must confirm</dt><dd>{selected.authority}</dd></div></dl>
        <div className={styles.policy}><ShieldCheck size={18} aria-hidden="true"/><div><strong>{selected.authorityClause}</strong><span>{selected.recommendation.notice}</span></div></div>
        <div className={styles.reasons}><h3>Recommendation reasons</h3>{selected.recommendation.reasons.map((reason) => <div key={`${reason.clause}-${reason.conclusion}`}><strong>{reason.clause}</strong><p>{reason.conclusion}</p><span>{reason.evidence}</span></div>)}</div>
        {selected.decisions.length > 0 && <div className={styles.ledger}><h3>Decision ledger</h3>{selected.decisions.map((entry) => <div className={styles.ledgerRow} key={entry.id}><span className={styles.ledgerMark}>{entry.sequence}</span><div><strong>{entry.effectiveOutcome} · {entry.analystName}</strong><p>{entry.notes}</p>{entry.overrideReason && <span>Override: {entry.overrideReason}</span>}<time dateTime={entry.recordedAt}>{new Date(entry.recordedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" })}</time></div></div>)}</div>}
        <form className={styles.form} onSubmit={submit}><h3>{selected.queueStatus === "awaiting_second_analyst" ? "Independent decline review" : "Record decision"}</h3>{selected.queueStatus === "awaiting_second_analyst" && <Alert tone="warning" title="Four-eyes control">A different analyst must independently confirm the decline before it is final.</Alert>}
          <Field label="Analyst name"><Input value={analystName} onChange={(event) => setAnalystName(event.target.value)} required autoComplete="name" /></Field>
          <div className={styles.actions} role="group" aria-label="Decision"><Button size="sm" variant={decision === "approve" ? "primary" : "secondary"} icon={<Check size={15}/>} onClick={() => setDecision("approve")} disabled={selected.queueStatus === "awaiting_second_analyst" || selected.recommendation.outcome !== "Approve"}>Approve</Button><Button size="sm" variant={decision === "refer" ? "primary" : "secondary"} icon={<CornerUpRight size={15}/>} onClick={() => setDecision("refer")} disabled={selected.queueStatus === "awaiting_second_analyst" || selected.recommendation.outcome !== "Refer"}>Refer</Button><Button size="sm" variant={decision === "override" ? "primary" : "secondary"} onClick={() => setDecision("override")} disabled={selected.queueStatus === "awaiting_second_analyst"}>Override</Button><Button size="sm" variant={decision === "decline" ? "danger" : "secondary"} icon={<ThumbsDown size={15}/>} onClick={() => setDecision("decline")} disabled={selected.recommendation.outcome !== "Decline"}>Decline</Button></div>
          {decision === "override" && <div className={styles.overrideFields}><Field label="Override outcome"><Select value={overrideOutcome} onChange={(event) => setOverrideOutcome(event.target.value as typeof overrideOutcome)} options={[{ value: "Approve", label: "Approve" }, { value: "Refer", label: "Refer" }, { value: "Decline", label: "Decline" }]} /></Field><Field label="Appendix A reason"><Select value={overrideReason} onChange={(event) => setOverrideReason(event.target.value as OverrideReason)} options={overrideReasons.map((reason) => ({ value: reason, label: reason }))} /></Field></div>}
          <Field label="Reason and notes" hint="Recorded with your name and decision."><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} required minLength={5} rows={3} /></Field>{formError && <Alert tone="danger" title="Decision not recorded">{formError}</Alert>}<Button type="submit" variant="primary" loading={saving}>Record {decision === "override" ? "override" : decision}</Button>
        </form>
      </section> : !loading && <ErrorState title="Select a case" message="Choose a case from the queue to review its recommendation." />}
    </div>
  </div>;
}
