import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderAt, status } from "./helpers.tsx";

const item = { application: { id: "app-1007", businessName: "Al Nakhil Packaging", businessNameArabic: "تغليف النخيل", commercialRegistration: "1010842763", product: "working_capital", amountSar: 1850000, stage: "decision_required", receivedAt: "2026-11-04T08:20:00.000Z", city: "Riyadh", riskGrade: "D" }, recommendation: { outcome: "Decline", riskGrade: "D", indicativeProfitRate: null, decisionAuthority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1", notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.", createdAt: "2026-11-11T08:40:00.000Z", reasons: [{ clause: "SME-CP-07 §6", conclusion: "The policy exception supports a decline recommendation.", evidence: "The reviewed bureau finding records elevated risk.", findingIds: [] }] }, authority: "Credit analyst, then a second analyst (four eyes)", authorityClause: "SME-CP-07 §7.1", decisions: [], queueStatus: "awaiting_decision" };

describe("analyst review queue", () => {
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
    expect(api.calls).toContainEqual({ method: "POST", path: "/api/reviews/app-1007/decisions", search: "", body: { analystIdentityId: "maha-alotaibi", expectedSequence: 1, decision: "override", notes: "Documented repayment history supports approval.", overrideReason: "Relationship history with the Bank", overrideOutcome: "Approve" } });
  });

  it("locks a pending decline to an independent decline review", async () => {
    const pending = { ...item, recommendation: { ...item.recommendation, outcome: "Approve" }, decisions: [{ id: "d-1", applicationId: "app-1007", analystId: "maha-alotaibi", analystName: "Maha Alotaibi", decision: "override", effectiveOutcome: "Decline", notes: "Evidence does not meet policy.", overrideReason: "Sector or market conditions", recordedAt: "2026-11-11T10:00:00Z", status: "awaiting_second_analyst", sequence: 1 }], queueStatus: "awaiting_second_analyst" };
    mockApi({ "GET /api/reviews": () => ({ items: [pending], sampleData: true }) }); renderAt("/reviews");
    expect(await screen.findByRole("heading", { name: "Independent decline review" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Decision" });
    expect(within(group).getByRole("button", { name: "Reject decline" })).toBeEnabled();
    expect(within(group).getByRole("button", { name: "Confirm decline" })).toBeEnabled();
    expect(screen.getByText("Evidence does not meet policy.")).toBeInTheDocument();
    expect(screen.getByLabelText("Record decision as")).toHaveDisplayValue("Faisal Alqahtani — Credit analyst");
    expect(screen.queryByRole("option", { name: "Maha Alotaibi — Credit analyst" })).not.toBeInTheDocument();
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
