import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { decisionLedgerFilename, escapeCsvCell } from "../src/features/reviews/decision-ledger-csv.ts";
import { logger } from "../src/logger.ts";
import { platformToken, testApp, useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();
const bearer = (profileId: "maha-alotaibi" | "faisal-alqahtani" | "noura-alharbi", subject: string, role?: "relationship_manager" | "credit_analyst" | "senior_credit_officer" | "credit_committee") => `Bearer ${platformToken(profileId, subject, role)}`;

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
    {
      _id: "app-3",
      businessName: "Sahil Logistics",
      businessNameArabic: "سهيل اللوجستية",
      commercialRegistration: "1010918742",
      product: "working_capital",
      amountSar: 950_000,
      stage: "decision_required",
      receivedAt: new Date("2026-11-06T07:30:00Z"),
      city: "Jeddah",
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
    {
      _id: "run-3",
      applicationId: "app-3",
      status: "completed",
      startedAt: "2026-11-09T08:00:00.000Z",
      finalRecommendation: { outcome: "Decline", decisionAuthority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1" },
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
    {
      _id: "decision-pending",
      applicationId: "app-3",
      assessmentRunId: "run-3",
      analystId: "platform-user-17",
      analystName: "Maha Alotaibi",
      decision: "decline",
      effectiveOutcome: "Decline",
      notes: "Bureau evidence does not meet policy; awaiting independent confirmation.",
      recordedAt: "2026-11-11T09:15:00.000Z",
      status: "awaiting_second_analyst",
      sequence: 1,
      ledgerSlot: 1,
    },
  ]);
}

describe("decision ledger CSV export", () => {
  it("downloads the full ledger newest first with override and policy columns", async () => {
    await seedLedger();
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").set("authorization", bearer("maha-alotaibi", "platform-user-17")).expect(200);

    expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="decision-ledger-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(response.headers["cache-control"]).toBe("no-store, private");
    expect(response.headers.pragma).toBe("no-cache");
    const rows = parseCsv(response.text);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(["Application reference", "Applicant", "Decided by", "Outcome", "Status", "Data source", "Override reason", "Policy clause", "Decided at"]);
    expect(rows[1]).toEqual(["APP-2", 'Al Nakhil Packaging, "Riyadh"', "Faisal Alqahtani", "Approve", "Final", "Sample data", "Relationship history with the Bank", "SME-CP-07 §7.1", "2026-11-11T14:32:00.000Z"]);
    expect(rows[2]).toEqual(["APP-3", "Sahil Logistics", "Maha Alotaibi", "Pending second analyst", "Awaiting second analyst", "Sample data", "", "", "2026-11-11T09:15:00.000Z"]);
    expect(rows[3]).toEqual(["APP-1", "Rawafid Industrial Supplies", "Maha Alotaibi", "Decline", "Final", "Sample data", "", "", "2026-11-10T09:05:00.000Z"]);
  });

  it("marks a live decision as live data in the same column", async () => {
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applications").insertOne({
      _id: "app-live", businessName: "Live Trading", businessNameArabic: "تجارة", commercialRegistration: "1010000009",
      product: "working_capital", amountSar: 500000, stage: "decision_required", receivedAt: new Date("2026-11-12T08:00:00Z"), city: "Riyadh", sampleData: false,
    });
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("applicationCheckRuns").insertOne({
      _id: "run-live", applicationId: "app-live", status: "completed", startedAt: "2026-11-12T09:00:00.000Z",
      finalRecommendation: { outcome: "Approve", decisionAuthority: "Credit analyst confirms", authorityClause: "SME-CP-07 §7.1" },
    });
    await mongo.db.collection<{ _id: string; [key: string]: unknown }>("creditDecisions").insertOne({
      _id: "decision-live", applicationId: "app-live", assessmentRunId: "run-live", analystId: "platform-user-17",
      analystName: "Maha Alotaibi", decision: "approve", effectiveOutcome: "Approve", notes: "All checks clear.",
      recordedAt: "2026-11-12T10:00:00.000Z", status: "final", sequence: 1, ledgerSlot: 1,
    });
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").set("authorization", bearer("maha-alotaibi", "platform-user-17")).expect(200);
    const rows = parseCsv(response.text);
    expect(rows[1]).toContain("Live data");
  });

  it("returns only the header when the ledger is empty", async () => {
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").set("authorization", bearer("maha-alotaibi", "platform-user-17")).expect(200);
    expect(parseCsv(response.text)).toEqual([["Application reference", "Applicant", "Decided by", "Outcome", "Status", "Data source", "Override reason", "Policy clause", "Decided at"]]);
  });

  it("answers 401 with no file when there is no signed-in principal", async () => {
    await seedLedger();
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").expect(401);
    expect(response.body.error.code).toBe("unauthorized");
    expect(response.text).not.toContain("Application reference");
  });

  it("answers 403 with no file when the signed-in role may not see the review queue", async () => {
    await seedLedger();
    const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").set("authorization", bearer("maha-alotaibi", "platform-user-17", "relationship_manager")).expect(403);
    expect(response.body.error.code).toBe("forbidden");
    expect(response.text).not.toContain("Application reference");
  });

  it("lets analysts, senior credit officers and the credit committee export", async () => {
    for (const role of ["credit_analyst", "senior_credit_officer", "credit_committee"] as const) {
      const response = await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").set("authorization", bearer("noura-alharbi", `platform-user-${role}`, role)).expect(200);
      expect(parseCsv(response.text)[0]).toEqual(["Application reference", "Applicant", "Decided by", "Outcome", "Status", "Data source", "Override reason", "Policy clause", "Decided at"]);
    }
  });

  it("logs each successful export with the acting user id", async () => {
    await seedLedger();
    const info = vi.spyOn(logger, "info");
    await request(testApp(mongo.db)).get("/api/reviews/decisions.csv").set("authorization", bearer("noura-alharbi", "platform-user-42", "senior_credit_officer")).expect(200);
    expect(info).toHaveBeenCalledWith("decision ledger exported", expect.objectContaining({ userId: "platform-user-42" }));
    vi.restoreAllMocks();
  });

  it("quotes separators, quotes and line breaks in one cell", () => {
    expect(escapeCsvCell("Al Nakhil, Packaging")).toBe('"Al Nakhil, Packaging"');
    expect(escapeCsvCell('Al Nakhil "Packaging"')).toBe('"Al Nakhil ""Packaging"""');
    expect(escapeCsvCell("Line one\nLine two")).toBe('"Line one\nLine two"');
    expect(escapeCsvCell(undefined)).toBe("");
    expect(decisionLedgerFilename(new Date("2026-11-11T23:59:00Z"))).toBe("decision-ledger-2026-11-11.csv");
  });

  it("treats a cell beginning with a spreadsheet formula character as literal text", () => {
    expect(escapeCsvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(escapeCsvCell("+966 11 000 0000")).toBe("'+966 11 000 0000");
    expect(escapeCsvCell("-Al Nakhil")).toBe("'-Al Nakhil");
    expect(escapeCsvCell("@supplier")).toBe("'@supplier");
    expect(escapeCsvCell("\t=cmd")).toBe("'\t=cmd");
    expect(escapeCsvCell('=Al Nakhil, "Riyadh"')).toBe(`"'=Al Nakhil, ""Riyadh"""`);
    for (const value of ["=1+1", "+1", "-1", "@x", "\t=1"]) {
      expect(escapeCsvCell(value)).toMatch(/^'/);
    }
  });
});
