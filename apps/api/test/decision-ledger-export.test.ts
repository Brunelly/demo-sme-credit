import request from "supertest";
import { describe, expect, it } from "vitest";
import { decisionLedgerFilename, escapeCsvCell } from "../src/features/reviews/decision-ledger-csv.ts";
import { testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

/** A small RFC 4180 reader so the test proves quoted commas stay in one cell. */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function seedLedger() {
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertMany([
    {
      _id: "app-2",
      businessName: 'Al Nakhil Packaging, "Riyadh"',
      businessNameArabic: "تغليف النخيل",
      commercialRegistration: "1010842763",
      product: "working_capital",
      amountSar: 1_850_000,
      stage: "decision_required",
      receivedAt: new Date("2026-11-04T08:20:00Z"),
      city: "Riyadh",
      sampleData: true,
    },
    {
      _id: "app-1",
      businessName: "Rawafid Industrial Supplies",
      businessNameArabic: "روافد للتوريدات الصناعية",
      commercialRegistration: "1010763428",
      product: "invoice_financing",
      amountSar: 3_200_000,
      stage: "referred",
      receivedAt: new Date("2026-11-05T10:45:00Z"),
      city: "Riyadh",
      sampleData: true,
    },
  ]);
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertMany([
    {
      _id: "run-2",
      applicationId: "app-2",
      status: "completed",
      startedAt: "2026-11-11T08:00:00.000Z",
      finalRecommendation: { outcome: "Decline", decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1" },
    },
    {
      _id: "run-1",
      applicationId: "app-1",
      status: "completed",
      startedAt: "2026-11-10T08:00:00.000Z",
      finalRecommendation: { outcome: "Decline", decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1" },
    },
  ]);
  await mongo.db.collection<{ _id: string; [key: string]: unknown }>("creditDecisions").insertMany([
    {
      _id: "decision-new",
      applicationId: "app-2",
      assessmentRunId: "run-2",
      analystId: "platform-user-29",
      analystName: "Faisal Alqahtani",
      decision: "override",
      effectiveOutcome: "Approve",
      overrideReason: "Relationship history with the Bank",
      notes: "Existing facilities have been serviced on time for two years.",
      recordedAt: "2026-11-11T14:32:00.000Z",
      status: "final",
      sequence: 1,
      ledgerSlot: 1,
    },
    {
      _id: "decision-old",
      applicationId: "app-1",
      assessmentRunId: "run-1",
      analystId: "platform-user-17",
      analystName: "Maha Alotaibi",
      decision: "decline",
      effectiveOutcome: "Decline",
      notes: "Bureau evidence does not meet policy.",
      recordedAt: "2026-11-10T09:05:00.000Z",
      status: "final",
      sequence: 1,
      ledgerSlot: 1,
    },
  ]);
}

describe("decision ledger CSV export", () => {
  it("downloads the full ledger newest first with override and policy columns", async () => {
    await seedLedger();
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").expect(200);

    expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="decision-ledger-\d{4}-\d{2}-\d{2}\.csv"$/);
    const rows = parseCsv(response.text);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["Application reference", "Applicant", "Decided by", "Outcome", "Override reason", "Policy clause", "Decided at"]);
    expect(rows[1]).toEqual(["APP-2", 'Al Nakhil Packaging, "Riyadh"', "Faisal Alqahtani", "Approve", "Relationship history with the Bank", "SME-CP-07 §7.1", "2026-11-11T14:32:00.000Z"]);
    expect(rows[2]).toEqual(["APP-1", "Rawafid Industrial Supplies", "Maha Alotaibi", "Decline", "", "", "2026-11-10T09:05:00.000Z"]);
  });

  it("returns only the header when the ledger is empty", async () => {
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").expect(200);
    expect(parseCsv(response.text)).toEqual([["Application reference", "Applicant", "Decided by", "Outcome", "Override reason", "Policy clause", "Decided at"]]);
  });

  it("quotes separators, quotes and line breaks in one cell", () => {
    expect(escapeCsvCell("Al Nakhil, Packaging")).toBe('"Al Nakhil, Packaging"');
    expect(escapeCsvCell('Al Nakhil "Packaging"')).toBe('"Al Nakhil ""Packaging"""');
    expect(escapeCsvCell("Line one\nLine two")).toBe('"Line one\nLine two"');
    expect(escapeCsvCell(undefined)).toBe("");
    expect(decisionLedgerFilename(new Date("2026-11-11T23:59:00Z"))).toBe("decision-ledger-2026-11-11.csv");
  });
});
