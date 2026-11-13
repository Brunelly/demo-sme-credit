import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderAt, status, text } from "./helpers.tsx";

const item = { application: { id: "app-1007", businessName: "Al Nakhil Packaging", businessNameArabic: "تغليف النخيل", commercialRegistration: "1010842763", product: "working_capital", amountSar: 1850000, stage: "decision_required", receivedAt: "2026-11-04T08:20:00.000Z", city: "Riyadh", riskGrade: "D" }, assessmentRunId: "run-1007", recommendation: { outcome: "Decline", riskGrade: "D", indicativeProfitRate: null, decisionAuthority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1", notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: "2026-11-11T08:40:00.000Z", reasons: [{ clause: "SME-CP-07 §6", conclusion: "The policy exception supports a decline recommendation.", evidence: "The reviewed bureau finding records elevated risk.", findingIds: [] }] }, authority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1", decisions: [], queueStatus: "awaiting_decision" };

describe("analyst review queue", () => {
  beforeEach(() => localStorage.clear());

  it("exports the decision ledger as a dated CSV download", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:decision-ledger");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const api = mockApi({
      "GET /api/reviews": () => ({ items: [item], sampleData: true }),
      "GET /api/reviews/decisions.csv": () => text("Application reference,Applicant\r\n", {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="decision-ledger-2026-11-12.csv"',
      }),
    });
    renderAt("/reviews");

    await userEvent.click(await screen.findByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe("decision-ledger-2026-11-12.csv");
    expect((click.mock.instances[0] as HTMLAnchorElement).getAttribute("href")).toBe("blob:decision-ledger");
    expect(api.calls).toContainEqual({ method: "GET", path: "/api/reviews/decisions.csv", search: "", body: undefined });
    vi.restoreAllMocks();
  });

  it("shows a translated export failure without a raw link", async () => {
    mockApi({
      "GET /api/reviews": () => ({ items: [item], sampleData: true }),
      "GET /api/reviews/decisions.csv": () => status(500, { error: { code: "internal_error", message: "Ledger unavailable" } }),
    });
    renderAt("/reviews");
    await userEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Export failed");
    expect(screen.queryByRole("link", { name: /CSV/i })).not.toBeInTheDocument();
  });

  it("shows an inline permission message and no file when the role may not export", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockApi({
      "GET /api/reviews": () => ({ items: [item], sampleData: true }),
      "GET /api/reviews/decisions.csv": () => status(403, { error: { code: "forbidden", message: "Your authenticated role cannot export the full decision ledger." } }),
    });
    renderAt("/reviews");
    await userEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your role does not have permission to export the decision ledger.");
    expect(click).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Arabic" }));
    await userEvent.click(screen.getByRole("button", { name: "تصدير CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("لا يسمح دورك بتصدير سجل القرارات.");
    vi.restoreAllMocks();
  });

  it("names the export in Arabic right to left", async () => {
    mockApi({ "GET /api/reviews": () => ({ items: [item], sampleData: true }) });
    renderAt("/reviews");
    await userEvent.click(await screen.findByRole("button", { name: "Switch to Arabic" }));
    expect(screen.getByRole("button", { name: "تصدير CSV" })).toBeInTheDocument();
  });

  it("shows authority and records an Appendix A override with analyst and notes", async () => {
    let queue = { items: [item], sampleData: true };
    const api = mockApi({ "GET /api/reviews": () => queue, "POST /api/reviews/app-1007/decisions": (body) => { queue = { items: [], sampleData: true }; return { id: "decision-1", applicationId: "app-1007", ...(body as object), effectiveOutcome: "Approve", recordedAt: "2026-11-11T10:00:00Z", status: "final", sequence: 1 }; } });
    renderAt("/reviews");
    expect(await screen.findByRole("heading", { name: "Analyst review queue" })).toBeInTheDocument();
    expect(screen.getAllByText("Credit analyst, then a second analyst (four eyes)").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Record decision as")).toHaveDisplayValue("Maha Alotaibi — Credit analyst");
    await userEvent.click(screen.getByRole("button", { name: "Override" }));
    await userEvent.selectOptions(screen.getByLabelText("Appendix A reason"), "Relationship history with the Bank");
    await userEvent.type(screen.getByLabelText("Reason and notes"), "Documented repayment history supports approval.");
    await userEvent.click(screen.getByRole("button", { name: "Record override" }));
    expect(api.calls).toContainEqual({ method: "POST", path: "/api/reviews/app-1007/decisions", search: "", body: { assessmentRunId: "run-1007", analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "override", notes: "Documented repayment history supports approval.", overrideReason: "Relationship history with the Bank", overrideOutcome: "Approve" } });
  });

  it("locks a pending decline to an independent decline review", async () => {
    const pending = { ...item, recommendation: { ...item.recommendation, outcome: "Approve" }, decisions: [{ id: "d-1", applicationId: "app-1007", analystId: "platform-user-17", analystName: "Maha Alotaibi", decision: "override", effectiveOutcome: "Decline", notes: "Evidence does not meet policy.", overrideReason: "Sector or market conditions", recordedAt: "2026-11-11T10:00:00Z", status: "awaiting_second_analyst", sequence: 1 }], queueStatus: "awaiting_second_analyst" };
    mockApi({ "GET /api/reviews": () => ({ items: [pending], sampleData: true }) }); renderAt("/reviews");
    expect(await screen.findByRole("heading", { name: "Independent decline review" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Decision" });
    expect(within(group).getByRole("button", { name: "Reject decline" })).toBeEnabled();
    expect(within(group).getByRole("button", { name: "Confirm decline" })).toBeEnabled();
    expect(screen.getByText("Evidence does not meet policy.")).toBeInTheDocument();
    expect(screen.getByLabelText("Record decision as")).toHaveDisplayValue("Faisal Alqahtani — Credit analyst");
    expect(screen.queryByRole("option", { name: "Maha Alotaibi — Credit analyst" })).not.toBeInTheDocument();
    const secondAnalysts = within(screen.getByLabelText("Record decision as")).getAllByRole("option").map((option) => option.textContent);
    expect(secondAnalysts).toHaveLength(2);
    expect(new Set(secondAnalysts).size).toBe(secondAnalysts.length);
  });

  it("explains why a sample recommendation cannot become a final decision", async () => {
    mockApi({ "GET /api/reviews": () => ({ items: [{ ...item, sampleData: true }], sampleData: true }) });
    renderAt("/reviews");
    expect(await screen.findByText("Sample assessment — decision not available")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reason and notes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record decision/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Arabic" }));
    expect(await screen.findByText("تقييم تجريبي — القرار غير متاح")).toBeInTheDocument();
  });

  it("clears case-specific notes, override selection and errors when another case is selected", async () => {
    const second = { ...item, application: { ...item.application, id: "app-1008", businessName: "Sample Eastern Services" } };
    mockApi({ "GET /api/reviews": () => ({ items: [item, second], sampleData: true }), "POST /api/reviews/app-1007/decisions": () => status(409, { error: { code: "conflict", message: "Ledger unavailable" } }) });
    renderAt("/reviews");
    await screen.findByRole("heading", { name: "Al Nakhil Packaging" });
    await userEvent.click(screen.getByRole("button", { name: "Override" }));
    await userEvent.selectOptions(screen.getByLabelText("Override outcome"), "Decline");
    await userEvent.selectOptions(screen.getByLabelText("Appendix A reason"), "Sector or market conditions");
    await userEvent.type(screen.getByLabelText("Reason and notes"), "These notes belong only to the first case.");
    await userEvent.click(screen.getByRole("button", { name: "Record override" }));
    expect(await screen.findByText("Ledger unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Sample Eastern Services"));
    expect(screen.getByLabelText("Reason and notes")).toHaveValue("");
    expect(screen.queryByText("Ledger unavailable")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Override outcome")).not.toBeInTheDocument();
  });
});
