import type { SimulatedScenario } from "@app/contracts";
import { Alert, Button, ErrorState, Field, Select, Skeleton } from "@app/ui";
import { Database, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { getSimulatedScenario, updateSimulatedScenario } from "../features/applications/applications.api.ts";
import { useResource } from "../lib/use-resource.ts";
import styles from "./SettingsPage.module.css";
import { usePreferences } from "../lib/preferences.tsx";
const options: { value: SimulatedScenario; label: string }[] = [
  { value: "clean", label: "All source checks clear" }, { value: "disputed_invoice", label: "Disputed invoice" },
  { value: "low_bureau", label: "High-risk bureau score" }, { value: "returned_cheques", label: "Several returned cheques" },
  { value: "ineligible_revenue", label: "Revenue below policy minimum" },
];
export function SettingsPage() {
  const { locale, t } = usePreferences();
  const resource = useResource(getSimulatedScenario, []); const [selected, setSelected] = useState<SimulatedScenario>("clean"); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => { if (resource.data) setSelected(resource.data.activeScenarioId); }, [resource.data]);
  async function save() { setSaving(true); setSaved(false); setError(undefined); try { await updateSimulatedScenario(selected); setSaved(true); resource.reload(); } catch (e) { setError(e instanceof Error ? e.message : "Scenario not saved."); } finally { setSaving(false); } }
  return <main className={styles.page}><header><div><h1>{t("Control-centre settings")}</h1><p>{t("Manage the simulated source data used by every subsequent assessment.")}</p></div><Database size={22} aria-hidden="true" /></header>{resource.loading ? <Skeleton height={180} /> : resource.error ? <ErrorState title={locale === "ar" ? "الإعدادات غير متاحة" : "Settings unavailable"} message={resource.error} onRetry={resource.reload} /> : <section className={styles.form} aria-labelledby="scenario-heading"><h2 id="scenario-heading">{t("Simulated assessment scenario")}</h2><p>{locale === "ar" ? "يُطبق باتساق على مصادر سمة وواثق وفاتورة والتدفق النقدي. تحتفظ عمليات التقييم الحالية بالسيناريو والإصدار المسجلين." : "Applies consistently to SIMAH, Wathq, ZATCA and cash-flow sources. Existing assessment runs keep their recorded scenario and version."}</p><Field label={t("Active scenario")}><Select value={selected} onChange={e => { setSelected(e.target.value as SimulatedScenario); setSaved(false); }} options={options} /></Field><dl><div><dt>{locale === "ar" ? "الإصدار الحالي" : "Current version"}</dt><dd>{resource.data?.version}</dd></div><div><dt>{locale === "ar" ? "آخر تعديل بواسطة" : "Last changed by"}</dt><dd>{resource.data?.updatedBy}</dd></div></dl>{saved && <Alert tone="success" title={locale === "ar" ? "تم حفظ السيناريو" : "Scenario saved"}>{locale === "ar" ? "ستستخدم التقييمات الجديدة هذا السيناريو." : "New assessments will use this scenario."}</Alert>}{error && <Alert tone="danger" title={locale === "ar" ? "لم يُحفظ السيناريو" : "Scenario not saved"}>{error}</Alert>}<Button variant="primary" icon={<Save size={15} />} loading={saving} disabled={selected === resource.data?.activeScenarioId} onClick={save}>{t("Save scenario")}</Button></section>}</main>;
}
