import type { DecisionLedgerRow } from "./reviews.repository.ts";

export const DECISION_LEDGER_HEADERS = [
  "Application reference",
  "Applicant",
  "Decided by",
  "Outcome",
  "Status",
  "Override reason",
  "Policy clause",
  "Decided at",
] as const;

/**
 * RFC 4180 cell escaping, with spreadsheet formula neutralising. A cell starting with =, +, -, @, tab or a
 * carriage return would otherwise be evaluated as a formula when opened in Excel, so it gets a leading apostrophe:
 * spreadsheets treat the rest as literal text, while the value still reads as the original text to a person.
 * Commas, quotes and line breaks then require a quoted cell, and quotes double up.
 */
export function escapeCsvCell(value: string | undefined): string {
  const text = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** The committee-facing label for a decision's lifecycle state. */
function statusLabel(status: DecisionLedgerRow["status"]): string {
  if (status === "final") return "Final";
  if (status === "awaiting_second_analyst") return "Awaiting second analyst";
  return "Recorded, not final";
}

/** A pending decision is not an outcome yet, so it must not read as an approve or decline. */
function outcomeLabel(row: DecisionLedgerRow): string {
  if (row.status === "awaiting_second_analyst") return "Pending second analyst";
  if (row.status === "final") return row.outcome;
  return "Pending decision";
}

/** The decision ledger as a spreadsheet-ready CSV: one header row, then one row per decision. */
export function toDecisionLedgerCsv(rows: readonly DecisionLedgerRow[]): string {
  const lines = [
    DECISION_LEDGER_HEADERS.map(escapeCsvCell).join(","),
    ...rows.map((row) => [
      row.applicationReference,
      row.applicantName,
      row.decidedBy,
      outcomeLabel(row),
      statusLabel(row.status),
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
