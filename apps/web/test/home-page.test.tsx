import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderAt, status } from "./helpers.tsx";
const applications = {
  sampleData: true,
  items: [
    {
      id: "app-1",
      businessName: "Al Nakhil Packaging",
      businessNameArabic: "تغليف النخيل",
      commercialRegistration: "1010842763",
      product: "working_capital",
      amountSar: 1850000,
      stage: "decision_required",
      receivedAt: "2026-11-04T08:20:00.000Z",
      city: "Riyadh",
      riskGrade: "B",
    },
    {
      id: "app-2",
      businessName: "Rawafid Industrial Supplies",
      businessNameArabic: "روافد للتوريدات الصناعية",
      commercialRegistration: "1010763428",
      product: "invoice_financing",
      amountSar: 3200000,
      stage: "referred",
      receivedAt: "2026-11-05T10:45:00.000Z",
      city: "Riyadh",
      riskGrade: "C",
    },
  ],
};
const at = "2026-11-11T09:00:00.000Z";
const finding = {
  id: "f-1",
  specialistType: "SIMAH credit bureau",
  round: 1,
  outcome: "refer",
  plainLanguageFinding: "The commercial score is High risk and requires referral.",
  sourceLabel: "Simulated SIMAH reports",
  evidence: [
    {
      fact: "Commercial score 528",
      sourceReference: "Commercial report · score",
    },
  ],
  policyCitations: ["SME-CP-07 §3.1"],
  createdAt: at,
  revisionSummary: null,
};
const run = {
  id: "run-1",
  applicationId: "app-1",
  scenarioId: "low_bureau",
  status: "completed",
  startedAt: at,
  completedAt: at,
  createdBy: "Credit analyst",
  failureReason: null,
  specialistFindings: [finding],
  reviewerChallenges: [
    {
      id: "r-1",
      findingId: "f-1",
      specialistType: "SIMAH credit bureau",
      status: "challenge",
      conclusion: "Policy consequence needs to be explicit.",
      evidenceGap: "State the score band.",
      reasoningDefect: "Incomplete consequence.",
      policyCitation: "SME-CP-07 §6",
      createdAt: at,
    },
  ],
  revisedFindings: [
    {
      ...finding,
      id: "f-2",
      round: 2,
      plainLanguageFinding: "Score 528 is High risk and requires grade D committee referral.",
      policyCitations: ["SME-CP-07 §3.1", "SME-CP-07 §6"],
      revisionSummary: "Added the policy consequence.",
    },
  ],
  finalRecommendation: {
    outcome: "Refer",
    riskGrade: "D",
    indicativeProfitRate: "Credit committee only",
    decisionAuthority: "Credit committee",
    authorityClause: "SME-CP-07 §7.1",
    notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1.",
    createdAt: at,
    reasons: [
      {
        clause: "SME-CP-07 §6",
        conclusion: "High risk requires committee review.",
        evidence: "Corrected SIMAH finding records score 528.",
        findingIds: ["f-2"],
      },
    ],
  },
};
describe("SME Credit Desk", () => {
  it("shows the queue and full chronological assessment trail without a case scenario control", async () => {
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items: [run],
        simulatedData: true,
      }),
    });
    renderAt("/");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Application queue",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "AI recommendation" })).toBeInTheDocument();
    expect(screen.getByText("First pass · SIMAH credit bureau")).toBeInTheDocument();
    expect(screen.getByText("Challenge recorded", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Reworked finding · SIMAH credit bureau")).toBeInTheDocument();
    expect(screen.getAllByText("Added the policy consequence.").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Assessment scenario")).not.toBeInTheDocument();
    expect(screen.getByText("Source scenario · Low bureau score")).toBeInTheDocument();
  });
  it("names the case-specific inputs missing for a grade and hides pricing in English and Arabic", async () => {
    const ungraded = {
      ...run,
      finalRecommendation: {
        ...run.finalRecommendation,
        riskGrade: null,
        indicativeProfitRate: null,
        missingGradeInputs: ["owner_credit_reports", "buyer_quality"],
      },
    };
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({ items: [ungraded], simulatedData: true }),
    });
    renderAt("/");
    expect(await screen.findByText("No grade yet: owner credit reports and buyer quality")).toBeVisible();
    expect(screen.queryByText(/pricing|not supported/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Arabic" }));
    expect(await screen.findByText("لا توجد درجة بعد: التقارير الائتمانية للملاك وتصنيف المشتري")).toBeVisible();
    expect(screen.queryByText(/not supported/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "التبديل إلى الإنجليزية" }));
  });
  it("opens a recommendation reason into its policy, evidence, and reviewer re-pass tree", async () => {
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items: [run],
        simulatedData: true,
      }),
    });
    renderAt("/");
    const reason = await screen.findByText("High risk requires committee review.", { selector: "summary strong" });
    const branch = reason.closest("details");
    expect(branch).not.toHaveAttribute("open");
    await userEvent.click(reason);
    expect(branch).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "AI recommendation" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Policy clause" })).toHaveTextContent("SME-CP-07 §6");
    expect(screen.getByRole("region", { name: "Evidence" })).toHaveTextContent("Commercial score 528");
    const review = screen.getByRole("region", {
      name: "Reviewer pushback and re-pass",
    });
    expect(review).toHaveTextContent("Pushback: Policy consequence needs to be explicit.");
    expect(review).toHaveTextContent("Changed after re-pass: Added the policy consequence.");
    await userEvent.click(reason);
    expect(branch).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "AI recommendation" })).toBeVisible();
  });
  it("renders a recorded override reason and rationale without template-literal dollar signs", async () => {
    const overridden = {
      ...run,
      finalRecommendation: {
        ...run.finalRecommendation,
        override: {
          outcome: "Approve",
          reason: "Relationship history with the Bank",
          rationale: "Documented repayment performance supports approval.",
          recordedAt: at,
          recordedBy: "Credit analyst",
        },
      },
    };
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items: [overridden],
        simulatedData: true,
      }),
    });
    renderAt("/");
    expect(await screen.findByText(/Relationship history with the Bank — Documented repayment performance supports approval\./)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
  it("runs an assessment, refreshes history, and exposes a safe failure", async () => {
    let items: unknown[] = [];
    const api = mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items,
        simulatedData: true,
      }),
      "POST /api/applications/app-1/assessment-runs": () => {
        items = [run];
        return run;
      },
    });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Run assessment" }));
    expect(await screen.findByText("The commercial score is High risk and requires referral.")).toBeInTheDocument();
    expect(api.calls).toContainEqual({
      method: "POST",
      path: "/api/applications/app-1/assessment-runs",
      search: "",
      body: {},
    });
  });
  it("shows the current Maitento stage and completed specialist finding", async () => {
    const runningRun = {
      ...run,
      status: "running",
      completedAt: null,
      finalRecommendation: null,
      reviewerChallenges: [],
      revisedFindings: [],
      steps: [
        {
          key: "SIMAH credit bureau",
          label: "SIMAH credit bureau",
          status: "completed",
          startedAt: at,
          completedAt: at,
          maitentoRunIds: ["mt-1"],
        },
        {
          key: "Wathq company verification",
          label: "Wathq company verification",
          status: "running",
          startedAt: at,
          completedAt: null,
          maitentoRunIds: [],
        },
        {
          key: "reviewer",
          label: "Independent reviewer",
          status: "queued",
          startedAt: null,
          completedAt: null,
          maitentoRunIds: [],
        },
      ],
    };
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items: [runningRun],
        simulatedData: true,
      }),
    });
    renderAt("/");
    expect(await screen.findByRole("list", { name: "Maitento assessment progress" })).toHaveTextContent("Wathq company verificationRunning through Maitento");
    expect(screen.getByText("The commercial score is High risk and requires referral.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Assessment running" })).toBeDisabled();
  });
  it("shows assessment request failures without internal details", async () => {
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items: [],
        simulatedData: true,
      }),
      "POST /api/applications/app-1/assessment-runs": () =>
        status(503, {
          error: {
            code: "dependency_unavailable",
            message: "Assessment service is temporarily unavailable.",
          },
        }),
    });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Run assessment" }));
    expect(await screen.findByText("Assessment service is temporarily unavailable.")).toBeInTheDocument();
  });
  it("names a failed stage, preserves completed stages, and enables rerun", async () => {
    const failure = "Final recommendation assistant failed: Maitento could not complete this stage. Start a new assessment to try again.";
    const failedRun = {
      ...run,
      status: "failed",
      finalRecommendation: null,
      failureReason: failure,
      steps: [
        {
          key: "SIMAH credit bureau",
          label: "SIMAH credit bureau",
          status: "completed",
          startedAt: at,
          completedAt: at,
          maitentoRunIds: ["mt-1"],
          failureReason: null,
        },
        {
          key: "final",
          label: "Final recommendation assistant",
          status: "failed",
          startedAt: at,
          completedAt: at,
          maitentoRunIds: [],
          failureReason: failure,
        },
      ],
    };
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({
        items: [failedRun],
        simulatedData: true,
      }),
    });
    renderAt("/");
    expect(await screen.findByRole("list", { name: "Maitento assessment progress" })).toHaveTextContent("SIMAH credit bureauCompleted");
    expect(screen.getAllByText(failure)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Run assessment" })).toBeEnabled();
  });
  it("does not expose an in-app Settings page or navigation item", async () => {
    mockApi({});
    renderAt("/settings");
    expect(await screen.findByText("This page doesn't exist")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });
});
