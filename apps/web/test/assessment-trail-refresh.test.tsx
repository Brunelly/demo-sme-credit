import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderAt } from "./helpers.tsx";

const at = "2026-11-13T08:42:00.000Z";

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
      stage: "credit_assessment",
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
      stage: "credit_assessment",
      receivedAt: "2026-11-05T10:45:00.000Z",
      city: "Riyadh",
      riskGrade: "C",
    },
  ],
};

const simahFinding = {
  id: "f-simah",
  specialistType: "SIMAH credit bureau" as const,
  round: 1 as const,
  outcome: "refer" as const,
  plainLanguageFinding: "Commercial score 612 is Moderate risk; the facility needs a referral.",
  sourceLabel: "Simulated SIMAH commercial report",
  evidence: [{ fact: "Commercial score 612", sourceReference: "Commercial report · score" }],
  policyCitations: ["SME-CP-07 §3.1"],
  createdAt: at,
  revisionSummary: null,
};

const wathqFinding = {
  id: "f-wathq",
  specialistType: "Wathq company verification" as const,
  round: 1 as const,
  outcome: "pass" as const,
  plainLanguageFinding: "Wathq confirms the registration is active and matches the applicant.",
  sourceLabel: "Simulated Wathq company record",
  evidence: [{ fact: "Registration 1010842763 is active", sourceReference: "Wathq · company profile" }],
  policyCitations: ["SME-CP-07 §2.2"],
  createdAt: at,
  revisionSummary: null,
};

const steps = [
  {
    key: "SIMAH credit bureau",
    label: "SIMAH credit bureau",
    status: "completed" as const,
    startedAt: at,
    completedAt: at,
    maitentoRunIds: ["mt-simah"],
  },
  {
    key: "Wathq company verification",
    label: "Wathq company verification",
    status: "running" as const,
    startedAt: at,
    completedAt: null,
    maitentoRunIds: [],
  },
  {
    key: "reviewer",
    label: "Independent reviewer",
    status: "queued" as const,
    startedAt: null,
    completedAt: null,
    maitentoRunIds: [],
  },
];

const runningRun = {
  id: "run-1",
  applicationId: "app-1",
  scenarioId: "low_bureau" as const,
  status: "running" as const,
  startedAt: at,
  completedAt: null,
  createdBy: "Credit analyst" as const,
  failureReason: null,
  specialistFindings: [simahFinding],
  reviewerChallenges: [],
  revisedFindings: [],
  finalRecommendation: null,
  steps,
};

const completedRun = {
  ...runningRun,
  status: "completed" as const,
  completedAt: at,
  steps: steps.map((step) => ({ ...step, status: "completed" as const, completedAt: at })),
  finalRecommendation: {
    outcome: "Refer" as const,
    riskGrade: "C" as const,
    indicativeProfitRate: "SAIBOR + 4.0%",
    decisionAuthority: "Credit analyst reviews the flagged checks" as const,
    authorityClause: "SME-CP-07 §7.1" as const,
    notice: "AI recommendation — a human must make the decision under SME-CP-07 §7.1." as const,
    createdAt: at,
    reasons: [
      {
        clause: "SME-CP-07 §3.1",
        conclusion: "Moderate bureau risk requires analyst review.",
        evidence: "SIMAH records commercial score 612 in the Moderate band.",
        findingIds: ["f-simah"],
      },
    ],
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("assessment trail refresh", () => {
  it("keeps the rendered trail while the next poll is in flight, then adds only the new finding", async () => {
    const nextPoll = deferred<unknown>();
    let requests = 0;
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => {
        requests += 1;
        return requests === 1 ? { items: [runningRun], simulatedData: true } : nextPoll.promise;
      },
    });

    renderAt("/");
    const firstFinding = await screen.findByText(simahFinding.plainLanguageFinding);
    expect(screen.getByRole("list", { name: "Maitento assessment progress" })).toHaveTextContent(
      "Wathq company verificationRunning through Maitento",
    );

    await waitFor(() => expect(requests).toBe(2), { timeout: 2500 });

    expect(screen.getByText(simahFinding.plainLanguageFinding)).toBe(firstFinding);
    expect(screen.queryByLabelText("Loading assessment history")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Maitento assessment progress" })).toHaveTextContent(
      "Wathq company verificationRunning through Maitento",
    );

    nextPoll.resolve({
      items: [{ ...runningRun, specialistFindings: [simahFinding, wathqFinding] }],
      simulatedData: true,
    });

    expect(await screen.findByText(wathqFinding.plainLanguageFinding)).toBeVisible();
    expect(screen.getByText(simahFinding.plainLanguageFinding)).toBe(firstFinding);
    expect(screen.getByRole("list", { name: "Maitento assessment progress" })).toBeInTheDocument();
  });

  it("shows the full trail and recommendation once the running assessment completes", async () => {
    let requests = 0;
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => {
        requests += 1;
        return requests === 1
          ? { items: [runningRun], simulatedData: true }
          : { items: [completedRun], simulatedData: true };
      },
    });

    renderAt("/");
    const firstFinding = await screen.findByText(simahFinding.plainLanguageFinding);

    expect(await screen.findByRole("heading", { name: "AI recommendation" }, { timeout: 2500 })).toBeVisible();
    expect(screen.getAllByText("Refer", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Grade C · SAIBOR \+ 4\.0%/)).toBeVisible();
    expect(screen.getByText("Reason and evidence tree")).toBeVisible();
    expect(screen.getByText(simahFinding.plainLanguageFinding)).toBe(firstFinding);
    expect(screen.getByRole("list", { name: "Maitento assessment progress" })).toHaveTextContent(
      "SIMAH credit bureauCompleted",
    );
  });

  it("shows a loading state in the trail when the first fetch returns a run with no findings yet", async () => {
    const firstPoll = deferred<unknown>();
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => firstPoll.promise,
    });

    renderAt("/");
    expect(await screen.findByLabelText("Loading assessment history")).toBeInTheDocument();

    firstPoll.resolve({
      items: [{ ...runningRun, specialistFindings: [] }],
      simulatedData: true,
    });

    expect(await screen.findByText(/Specialist findings are being prepared/)).toBeVisible();
    expect(screen.queryByText(simahFinding.plainLanguageFinding)).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Maitento assessment progress" })).toBeInTheDocument();
  });

  it("drops the previous case trail and shows loading when another case is selected", async () => {
    const secondCase = deferred<unknown>();
    mockApi({
      "GET /api/applications": () => applications,
      "GET /api/applications/app-1/assessment-runs": () => ({ items: [runningRun], simulatedData: true }),
      "GET /api/applications/app-2/assessment-runs": () => secondCase.promise,
    });

    renderAt("/");
    expect(await screen.findByText(simahFinding.plainLanguageFinding)).toBeVisible();

    await userEvent.click(screen.getByText("Rawafid Industrial Supplies"));

    expect(screen.queryByText(simahFinding.plainLanguageFinding)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading assessment history")).toBeInTheDocument();

    secondCase.resolve({
      items: [
        {
          ...runningRun,
          id: "run-2",
          applicationId: "app-2",
          scenarioId: "disputed_invoice",
          specialistFindings: [wathqFinding],
        },
      ],
      simulatedData: true,
    });

    expect(await screen.findByText(wathqFinding.plainLanguageFinding)).toBeVisible();
    expect(screen.queryByText(simahFinding.plainLanguageFinding)).not.toBeInTheDocument();
  });
});
