import type { Db } from "mongodb";

/**
 * 0015 restored the historical app-1029 throughput run to its recommendation-only shape, which the assessment-run
 * reads cannot parse: a document without `specialistFindings` is read as a legacy run and requires `performedAt`,
 * `results` and a `recommendation`, so listing app-1029's assessment runs throws. Complete that record in the
 * legacy shape the read path understands, preserving its historical recommendation, source round and timestamps.
 *
 * Idempotent: only a document still missing both `performedAt` and `results` is touched. Keeping the legacy shape
 * also means a re-run of 0014 or 0015 leaves it alone, because neither restores a document with specialist
 * findings over this record.
 */
const THROUGHPUT_RUN_ID = "sample-assessment-app-1029-throughput";
const HISTORICAL_STARTED_AT = "2026-11-10T11:00:00.000Z";

interface HistoricalRecommendation {
  outcome?: string;
  riskGrade?: string | null;
  indicativeProfitRate?: string | null;
  decisionAuthority?: string;
  authorityClause?: string;
  reasons?: { clause: string; conclusion: string; evidence: string }[];
}

export async function up(db: Db): Promise<void> {
  const runs = db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns");
  const run = await runs.findOne({ _id: THROUGHPUT_RUN_ID, performedAt: { $exists: false }, results: { $exists: false } });
  if (!run) return;

  const final = (run.finalRecommendation ?? {}) as HistoricalRecommendation;
  // Never invent a recommendation: the historical record already carries the outcome and authority it was made under.
  if (!final.outcome || !final.decisionAuthority) return;
  const startedAt = typeof run.startedAt === "string" && !Number.isNaN(new Date(run.startedAt).getTime())
    ? run.startedAt
    : HISTORICAL_STARTED_AT;
  const recommendation = {
    outcome: final.outcome,
    riskGrade: final.riskGrade ?? null,
    indicativeProfitRate: final.indicativeProfitRate ?? null,
    decisionAuthority: final.decisionAuthority,
    authorityClause: final.authorityClause ?? "SME-CP-07 §7.1",
    reasons: final.reasons ?? [],
    reviewerChallenges: [],
  };

  await runs.updateOne(
    { _id: THROUGHPUT_RUN_ID, performedAt: { $exists: false }, results: { $exists: false } },
    {
      $set: {
        scenario: typeof run.scenarioId === "string" ? run.scenarioId : "clean",
        performedAt: new Date(startedAt),
        results: [],
        recommendation,
      },
    },
  );
}
