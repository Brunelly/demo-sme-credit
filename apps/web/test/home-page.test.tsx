import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderAt } from "./helpers.tsx";

const applications = {
  sampleData: true,
  items: [
    { id: "app-1", businessName: "Al Nakhil Packaging", businessNameArabic: "تغليف النخيل", commercialRegistration: "1010842763", product: "working_capital", amountSar: 1850000, stage: "decision_required", receivedAt: "2026-11-04T08:20:00.000Z", city: "Riyadh", riskGrade: "B" },
    { id: "app-2", businessName: "Rawafid Industrial Supplies", businessNameArabic: "روافد للتوريدات الصناعية", commercialRegistration: "1010763428", product: "invoice_financing", amountSar: 3200000, stage: "referred", receivedAt: "2026-11-05T10:45:00.000Z", city: "Riyadh", riskGrade: "C" },
  ],
};

describe("SME Credit Desk", () => {
  it("shows the dense application queue and opens the first case alongside it", async () => {
    mockApi({ "GET /api/applications": () => applications, "GET /api/applications/app-1/checks": () => ({ latest: null, simulatedData: true }) });
    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Application queue" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("SME Credit Desk");
    expect(screen.getByRole("columnheader", { name: "Amount (SAR)" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Al Nakhil Packaging" })).toBeInTheDocument();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("selects another queue row and updates the case workspace", async () => {
    mockApi({ "GET /api/applications": () => applications, "GET /api/applications/app-1/checks": () => ({ latest: null, simulatedData: true }), "GET /api/applications/app-2/checks": () => ({ latest: null, simulatedData: true }) });
    renderAt("/");

    await userEvent.click(await screen.findByText("Rawafid Industrial Supplies"));
    const workspace = screen.getByRole("complementary", { name: "Selected application workspace" });
    expect(workspace).toHaveTextContent("Rawafid Industrial Supplies");
    expect(workspace).toHaveTextContent("Assessment scenario");
  });

  it("runs the four specialists and shows clause-labelled outcomes", async () => {
    const run = { id: "run-1", applicationId: "app-1", scenario: "low_bureau", performedAt: "2026-11-11T09:00:00.000Z", recommendation: { outcome: "Refer", riskGrade: "D", indicativeProfitRate: "Credit committee only", decisionAuthority: "Credit committee", authorityClause: "SME-CP-07 §7.1", reasons: [{ clause: "SME-CP-07 §§3.1, 6", conclusion: "High bureau risk creates a grade D exception.", evidence: "SIMAH score is 528." }], reviewerChallenges: [{ specialist: "SIMAH credit bureau", status: "challenge", conclusion: "Reviewer challenges the specialist conclusion.", evidenceGap: "A policy exception cannot be cleared at analyst level." }] }, results: [
      { specialist: "SIMAH credit bureau", clause: "SME-CP-07 §3.1", outcome: "refer", summary: "High risk bureau band requires analyst review.", evidence: ["Commercial score 528 · High risk"] },
      { specialist: "Wathq company verification", clause: "SME-CP-07 §3.2", outcome: "pass", summary: "CR verified.", evidence: ["CR active"] },
      { specialist: "ZATCA e-invoice verification", clause: "SME-CP-07 §3.3", outcome: "pass", summary: "Not required.", evidence: ["Working capital"] },
      { specialist: "Open banking cash flow", clause: "SME-CP-07 §3.4", outcome: "pass", summary: "Cash flow supports facility.", evidence: ["12 months analysed"] },
    ] };
    let latest: unknown = null;
    const api = mockApi({ "GET /api/applications": () => applications, "GET /api/applications/app-1/checks": () => ({ latest, simulatedData: true }), "POST /api/applications/app-1/checks": () => { latest = run; return run; } });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Run assessment" }));
    expect(await screen.findByText("High risk bureau band requires analyst review.")).toBeInTheDocument();
    expect(screen.getByText("SME-CP-07 §3.1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommendation" })).toBeInTheDocument();
    expect(screen.getByText("Credit committee")).toBeInTheDocument();
    expect(screen.getByText("A policy exception cannot be cleared at analyst level.")).toBeInTheDocument();
    expect(api.calls).toContainEqual({ method: "POST", path: "/api/applications/app-1/checks", search: "", body: { scenario: "clean" } });
  });

  it("explains a page that doesn't exist and goes back home", async () => {
    mockApi({ "GET /api/applications": () => applications });
    const { router } = renderAt("/nowhere");

    expect(await screen.findByText("This page doesn't exist")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go to the home page" }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("shows the UI kit in development", async () => {
    mockApi({});
    renderAt("/kit");
    expect(await screen.findByRole("heading", { level: 1, name: "UI kit" })).toBeInTheDocument();
  });
});
