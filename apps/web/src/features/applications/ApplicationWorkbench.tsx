import type { ApplicationCheckRun, CreditApplication, MissingGradeInput, OverrideReason, RecommendationOutcome, RecommendationReason, SpecialistFinding } from "@app/contracts";
import { Alert, Badge, Button, CellStack, DataTable, EmptyState, ErrorState, Field, Select, Skeleton, Textarea, type Column } from "@app/ui";
import { Check, ChevronRight, Circle, FileCheck2, LoaderCircle, MessageSquareWarning, Play, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useResource } from "../../lib/use-resource.ts";
import { productLabels, scenarioLabels, stageLabels } from "./application-labels.ts";
import { getAssessmentRuns, listApplications, recordRecommendationOverride, runApplicationAssessment } from "./applications.api.ts";
import styles from "./ApplicationWorkbench.module.css";
import { usePreferences } from "../../lib/preferences.tsx";
export function ApplicationWorkbench() {
  const { locale, t } = usePreferences();
  const sar = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
        style: "currency",
        currency: "SAR",
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const columns: readonly Column<CreditApplication>[] = [
    {
      key: "business",
      header: t("Business"),
      width: "40%",
      render: (a) => (
        <CellStack
          primary={locale === "ar" ? a.businessNameArabic : a.businessName}
          secondary={
            <>
              <span lang={locale === "ar" ? "en" : "ar"} dir={locale === "ar" ? "ltr" : "rtl"}>
                {locale === "ar" ? a.businessName : a.businessNameArabic}
              </span>{" "}
              · {locale === "ar" ? "س.ت" : "CR"} <bdi>{a.commercialRegistration}</bdi>
            </>
          }
        />
      ),
    },
    {
      key: "product",
      header: t("Product"),
      width: "23%",
      hideOnMobile: true,
      render: (a) => (locale === "ar" ? (a.product === "invoice_financing" ? "تمويل الفواتير" : "تمويل رأس المال العامل") : productLabels[a.product]),
    },
    {
      key: "amount",
      header: t("Amount (SAR)"),
      width: "19%",
      align: "end",
      hideOnMobile: true,
      render: (a) => <bdi>{sar.format(a.amountSar)}</bdi>,
    },
    {
      key: "stage",
      header: t("Stage"),
      width: "18%",
      render: (a) => (
        <Badge dot tone={stageLabels[a.stage].tone}>
          {locale === "ar"
            ? (
                {
                  assessment_in_progress: "قيد التقييم",
                  decision_required: "بانتظار القرار",
                  referred: "محال للمراجعة",
                  completed: "مكتمل",
                } as Record<string, string>
              )[a.stage]
            : stageLabels[a.stage].label}
        </Badge>
      ),
    },
  ];
  const resource = useResource(listApplications, []);
  const apps = useMemo(() => resource.data?.items ?? [], [resource.data]);
  const [selectedId, setSelectedId] = useState<string>();
  useEffect(() => {
    if (apps.length && !apps.some((a) => a.id === selectedId)) setSelectedId(apps[0]!.id);
  }, [apps, selectedId]);
  return (
    <section className={styles.workbench} aria-labelledby="queue-heading">
      <div className={styles.queuePane}>
        <div className={styles.queueHeading}>
          <div>
            <h1 id="queue-heading">{t("Application queue")}</h1>
            <p>{t("Oldest applications first")}</p>
          </div>
          {resource.data?.sampleData && <Badge tone="neutral">{t("Sample data")}</Badge>}
        </div>
        <DataTable columns={columns} rows={apps} rowKey={(a) => a.id} caption={t("SME financing applications")} onRowClick={(a) => setSelectedId(a.id)} isRowSelected={(a) => a.id === selectedId} loading={resource.loading} error={resource.error} onRetry={resource.reload} empty={<EmptyState title={t("No applications")} description={t("New applications will appear here.")} compact />} />
      </div>
      <aside className={styles.casePane} aria-label={t("Selected application workspace")}>
        {apps.find((a) => a.id === selectedId) ? <CaseWorkspace application={apps.find((a) => a.id === selectedId)!} /> : <p>{t("Select an application.")}</p>}
      </aside>
    </section>
  );
}
function CaseWorkspace({ application }: { application: CreditApplication }) {
  const { locale, t } = usePreferences();
  const sar = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
        style: "currency",
        currency: "SAR",
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const runs = useResource((signal) => getAssessmentRuns(application.id, signal), [application.id]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const activeRun = runs.data?.items.find((run) => run.status === "running");
  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(runs.reload, 900);
    return () => window.clearInterval(timer);
  }, [activeRun?.id, runs.reload]);
  async function start() {
    setRunning(true);
    setError(undefined);
    try {
      await runApplicationAssessment(application.id);
      runs.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assessment failed. Try again.");
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className={styles.caseContent}>
      <header className={styles.caseHeader}>
        <div>
          <h2>{locale === "ar" ? application.businessNameArabic : application.businessName}</h2>
          <p>
            <span lang={locale === "ar" ? "en" : "ar"} dir={locale === "ar" ? "ltr" : "rtl"}>
              {locale === "ar" ? application.businessName : application.businessNameArabic}
            </span>{" "}
            · {locale === "ar" ? "س.ت" : "CR"} <bdi className={styles.identifier}>{application.commercialRegistration}</bdi>
          </p>
        </div>
        <Badge dot tone={stageLabels[application.stage].tone}>
          {locale === "ar" ? "بانتظار القرار" : stageLabels[application.stage].label}
        </Badge>
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>{t("Product")}</dt>
          <dd>{locale === "ar" ? (application.product === "invoice_financing" ? "تمويل الفواتير" : "تمويل رأس المال العامل") : productLabels[application.product]}</dd>
        </div>
        <div>
          <dt>{t("Facility")}</dt>
          <dd>
            <bdi>{sar.format(application.amountSar)}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t("Buyer quality")}</dt>
          <dd>{application.invoice?.buyerCategory ?? t("Not applicable")}</dd>
        </div>
      </dl>
      <div className={styles.assessmentHeading}>
        <div>
          <h3>{t("Assessment trail")}</h3>
          <p>{t("Simulated sources · immutable specialist, review and rework record")}</p>
        </div>
        <Button variant="primary" size="sm" icon={running ? <RefreshCw size={15} /> : <Play size={15} />} loading={running} disabled={Boolean(activeRun)} onClick={start}>
          {activeRun ? t("Assessment running") : t("Run assessment")}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" title={t("Assessment not completed")}>
          {error}
        </Alert>
      )}
      {runs.loading ? (
        <div aria-label={t("Loading assessment history")}>
          <Skeleton height={32} />
          <Skeleton height={120} />
        </div>
      ) : runs.error ? (
        <ErrorState title={t("Assessment history unavailable")} message={runs.error} onRetry={runs.reload} compact />
      ) : runs.data?.items.length ? (
        <div className={styles.runs}>
          {runs.data.items.map((run, index) => (
            <AssessmentRun key={run.id} applicationId={application.id} run={run} latest={index === 0} onUpdated={runs.reload} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("No assessment history")} description={t("Run the four source specialists to create the first traceable assessment.")} compact />
      )}
    </div>
  );
}
function AssessmentRun({ applicationId, run, latest, onUpdated }: { applicationId: string; run: ApplicationCheckRun; latest: boolean; onUpdated: () => void }) {
  const { locale } = usePreferences();
  const dateTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", { dateStyle: "medium", timeStyle: "short" });
  const corrected = (finding: SpecialistFinding) => run.revisedFindings.find((r) => r.specialistType === finding.specialistType);
  return (
    <article className={styles.run} aria-labelledby={`run-${run.id}`}>
      <header className={styles.runHeader}>
        <div>
          <h4 id={`run-${run.id}`}>{latest ? "Latest assessment" : "Prior assessment"}</h4>
          <span>Source scenario · {scenarioLabels[run.scenarioId]}</span>
        </div>
        <div>
          <Badge tone={run.status === "completed" ? "success" : run.status === "running" ? "info" : "danger"}>{run.status}</Badge>
          <time dateTime={run.startedAt}>{dateTime.format(new Date(run.startedAt))}</time>
        </div>
      </header>
      {run.steps && (
        <ol className={styles.progress} aria-label="Maitento assessment progress">
          {run.steps.map((step) => (
            <li key={step.key} data-status={step.status}>
              {step.status === "completed" ? <Check size={15} /> : step.status === "running" ? <LoaderCircle size={15} className={styles.spinner} /> : <Circle size={13} />}
              <span>
                <strong>{step.label}</strong>
                <small>{step.failureReason ?? (step.status === "running" ? "Running through Maitento" : step.status === "completed" ? "Completed" : step.status)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
      {run.status === "failed" || run.status === "interrupted" ? (
        <Alert tone="danger" title="Assessment stopped">
          {run.failureReason ?? run.interruptedReason ?? "The run did not complete. Start a new assessment."}
        </Alert>
      ) : null}
      {run.finalRecommendation && <Recommendation applicationId={applicationId} run={run} onUpdated={onUpdated} />}
      <ol className={styles.timeline}>
        {run.specialistFindings.map((finding) => {
          const review = run.reviewerChallenges.find((r) => r.findingId === finding.id);
          const revision = corrected(finding);
          return (
            <li key={finding.id} className={styles.sourceBlock}>
              <Finding finding={finding} label="First pass" />
              {review && (
                <div className={styles.reviewLine}>
                  <MessageSquareWarning size={16} />
                  <div>
                    <strong>Independent reviewer · {review.status === "accepted" ? "Accepted first pass" : review.status === "human_review" ? "Human review required" : "Challenge recorded"}</strong>
                    <p>{review.conclusion}</p>
                    {review.evidenceGap && (
                      <p>
                        <b>Targeted gap:</b> {review.evidenceGap} {review.policyCitation}
                      </p>
                    )}
                    <time dateTime={review.createdAt}>{dateTime.format(new Date(review.createdAt))}</time>
                  </div>
                </div>
              )}
              {revision && <Finding finding={revision} label="Reworked finding" />}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
function Finding({ finding, label }: { finding: SpecialistFinding; label: string }) {
  const { locale } = usePreferences();
  const dateTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className={styles.finding}>
      <div className={styles.findingTitle}>
        <div>
          <span>
            {label} · {finding.specialistType}
          </span>
          <strong>{finding.sourceLabel}</strong>
        </div>
        <Badge tone={finding.outcome === "pass" ? "success" : "warning"}>{finding.outcome === "pass" ? "Supported" : finding.outcome === "human_review" ? "Human review" : "Refer"}</Badge>
      </div>
      <p>{finding.plainLanguageFinding}</p>
      <dl className={styles.evidence}>
        {finding.evidence.map((item) => (
          <div key={item.sourceReference}>
            <dt>{item.sourceReference}</dt>
            <dd>{item.fact}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.citations}>
        {finding.policyCitations.map((c) => (
          <Badge key={c} tone="neutral">
            {c}
          </Badge>
        ))}
      </div>
      {finding.revisionSummary && (
        <p className={styles.delta}>
          <strong>Revision delta:</strong> {finding.revisionSummary}
        </p>
      )}
      <time dateTime={finding.createdAt}>{dateTime.format(new Date(finding.createdAt))}</time>
    </section>
  );
}
const reasons: OverrideReason[] = ["Additional collateral or guarantee provided", "Information not available to the assessment", "Relationship history with the Bank", "Data quality issue in a source check", "Sector or market conditions"];
function Recommendation({ applicationId, run, onUpdated }: { applicationId: string; run: ApplicationCheckRun; onUpdated: () => void }) {
  const { locale, t } = usePreferences();
  const rec = run.finalRecommendation!;
  const [outcome, setOutcome] = useState<RecommendationOutcome>(rec.outcome === "Approve" ? "Refer" : "Approve");
  const [reason, setReason] = useState<OverrideReason>(reasons[0]);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const missingInputLabels: Record<MissingGradeInput, string> = locale === "ar"
    ? { commercial_credit_report: "التقرير الائتماني للمنشأة", owner_credit_reports: "التقارير الائتمانية للملاك", debt_service_coverage: "نسبة تغطية خدمة الدين", buyer_quality: "تصنيف المشتري" }
    : { commercial_credit_report: "commercial credit report", owner_credit_reports: "owner credit reports", debt_service_coverage: "debt service coverage", buyer_quality: "buyer quality" };
  const missingInputs = rec.missingGradeInputs?.map((input) => missingInputLabels[input]);
  const missingGradeReason = missingInputs?.length
    ? new Intl.ListFormat(locale === "ar" ? "ar-SA" : "en", { style: "long", type: "conjunction" }).format(missingInputs)
    : rec.reasons.map((item) => item.evidence).join(locale === "ar" ? "، " : "; ");
  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await recordRecommendationOverride(applicationId, run.id, {
        outcome,
        reason,
        rationale,
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override not recorded.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className={styles.recommendation} aria-label="AI recommendation">
      <div className={styles.decision}>
        <div>
          <h3>AI recommendation</h3>
          <p>{rec.notice}</p>
        </div>
        <div>
          <Badge dot tone={rec.outcome === "Approve" ? "success" : rec.outcome === "Refer" ? "warning" : "danger"}>
            {rec.outcome}
          </Badge>
          {rec.riskGrade ? (
            <strong>{locale === "ar" ? `الدرجة ${rec.riskGrade}` : `Grade ${rec.riskGrade}`}{rec.indicativeProfitRate ? ` · ${rec.indicativeProfitRate}` : ""}</strong>
          ) : (
            <strong>{t("No grade yet")}: {missingGradeReason}</strong>
          )}
        </div>
      </div>
      <div className={styles.authority}>
        <ShieldCheck size={17} />
        <span>
          {rec.decisionAuthority} · {rec.authorityClause}
        </span>
      </div>
      <div className={styles.reasonHeading}>
        <h4>Reason and evidence tree</h4>
        <span>
          {rec.reasons.length} {rec.reasons.length === 1 ? "reason" : "reasons"} · open a reason to trace it
        </span>
      </div>
      <div className={styles.reasonTree}>
        {rec.reasons.map((reason, index) => (
          <RecommendationReasonTree key={reason.clause + reason.conclusion} reason={reason} run={run} index={index} />
        ))}
      </div>
      {(rec.overrides?.length || rec.override) ? (
        <div>{(rec.overrides ?? (rec.override ? [rec.override] : [])).map((entry, index) => <Alert key={`${entry.recordedAt}-${index}`} tone="info" title={`Analyst override: ${entry.outcome}`}>
          {entry.reason} — {entry.rationale} · {entry.recordedBy} · {new Date(entry.recordedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" })}
        </Alert>)}</div>
      ) : null}
        <details className={styles.override}>
          <summary>{rec.overrides?.length || rec.override ? "Record another analyst override" : "Record analyst override"}</summary>
          <div className={styles.overrideFields}>
            <Field label="Decision" hint="Decline overrides are recorded in the review queue under four-eyes control.">
              <Select value={outcome} onChange={(e) => setOutcome(e.target.value as RecommendationOutcome)} options={["Approve", "Refer"].filter((v) => v !== rec.outcome).map((value) => ({ value, label: value }))} />
            </Field>
            <Field label="Appendix A reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value as OverrideReason)} options={reasons.map((value) => ({ value, label: value }))} />
            </Field>
          </div>
          <Field label="Written rationale">
            <Textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} />
          </Field>
          {error && (
            <Alert tone="danger" title="Override not recorded">
              {error}
            </Alert>
          )}
          <Button size="sm" loading={saving} disabled={rationale.trim().length < 10} onClick={save}>
            Record override
          </Button>
        </details>
    </section>
  );
}

function RecommendationReasonTree({ reason, run, index }: { reason: RecommendationReason; run: ApplicationCheckRun; index: number }) {
  const linkedFindings = reason.findingIds.flatMap((id) => {
    const revised = run.revisedFindings.find((finding) => finding.id === id);
    const original = run.specialistFindings.find((finding) => finding.id === id) ?? (revised && run.specialistFindings.find((finding) => finding.specialistType === revised.specialistType));
    const finding = revised ?? original;
    if (!finding) return [];
    const review = original && run.reviewerChallenges.find((challenge) => challenge.findingId === original.id);
    return [{ finding, original, review }];
  });
  return (
    <details className={styles.reasonBranch}>
      <summary>
        <ChevronRight size={16} aria-hidden="true" />
        <span className={styles.reasonNumber}>{index + 1}</span>
        <span>
          <strong>{reason.conclusion}</strong>
          <small>{reason.clause}</small>
        </span>
      </summary>
      <div className={styles.treeChildren}>
        <section className={styles.treeNode} aria-label="Policy clause">
          <Scale size={16} aria-hidden="true" />
          <div>
            <h5>Policy clause</h5>
            <strong>{reason.clause}</strong>
            <p>{reason.conclusion}</p>
          </div>
        </section>
        <section className={styles.treeNode} aria-label="Evidence">
          <FileCheck2 size={16} aria-hidden="true" />
          <div>
            <h5>Evidence</h5>
            <p>{reason.evidence}</p>
            {linkedFindings.map(({ finding }) => (
              <div className={styles.findingEvidence} key={finding.id}>
                <strong>{finding.specialistType}</strong>
                <span>{finding.sourceLabel}</span>
                <dl>
                  {finding.evidence.map((item) => (
                    <div key={item.sourceReference}>
                      <dt>{item.sourceReference}</dt>
                      <dd>{item.fact}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.treeNode} aria-label="Reviewer pushback and re-pass">
          <MessageSquareWarning size={16} aria-hidden="true" />
          <div>
            <h5>Reviewer pushback and re-pass</h5>
            {linkedFindings.map(({ finding, original, review }) => (
              <div className={styles.reviewEvidence} key={finding.id}>
                {review?.status === "challenge" ? (
                  <>
                    <strong>Pushback: {review.conclusion}</strong>
                    {review.evidenceGap && (
                      <p>
                        {review.evidenceGap} {review.policyCitation}
                      </p>
                    )}
                    <p>
                      <b>Changed after re-pass:</b> {finding.revisionSummary ?? "The finding was re-run; no revision summary was recorded."}
                    </p>
                    <p>
                      <b>Final finding:</b> {finding.plainLanguageFinding}
                    </p>
                  </>
                ) : review?.status === "human_review" ? (
                  <>
                    <strong>Human review required: {review.conclusion}</strong>
                    {review.evidenceGap && <p>{review.evidenceGap} {review.policyCitation}</p>}
                    <p>The finding cannot be treated as supported until an analyst resolves the evidence gap.</p>
                  </>
                ) : (
                  <>
                    <strong>No reviewer pushback</strong>
                    <p>{review?.conclusion ?? "The linked evidence was retained without a requested change."}</p>
                    <p>
                      <b>After review:</b> {original && finding.id !== original.id ? finding.revisionSummary : "The first-pass finding was accepted unchanged."}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}
