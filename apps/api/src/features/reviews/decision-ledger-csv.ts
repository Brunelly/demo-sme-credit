import type { DecisionLedgerRow } from "./reviews.repository.ts";

export const DECISION_LEDGER_HEADERS = [
  "Application reference",
  "Applicant",
  "Decided by",
  "Outcome",
  "Override reason",
  "Policy clause",
  "Decided at",
] as const;

/** RFC 4180 cell escaping: commas, quotes and line breaks require a quoted cell, and quotes double up. */
export function escapeCsvCell(value: string | undefined): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The decision ledger as a spreadsheet-ready CSV: one header row, then one row per decision. */
export function toDecisionLedgerCsv(rows: readonly DecisionLedgerRow[]): string {
  const lines = [
    DECISION_LEDGER_HEADERS.map(escapeCsvCell).join(","),
    ...rows.map((row) => [
      row.applicationReference,
      row.applicantName,
      row.decidedBy,
      row.outcome,
      row.overrideReason,
      row.policyClause,
      row.decidedAt,
    ].map(escapeCsvCell).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/** decision-ledger-2026-11-11.csv, using the UTC date so the name is stable wherever the API runs. */
export function decisionLedgerFilename(now: Date): string {
  return `decision-ledger-${now.toISOString().slice(0, 10)}.csv`;
}
