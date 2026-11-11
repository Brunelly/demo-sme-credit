import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { mockApi, renderAt } from "./helpers.tsx";

describe("language and theme preferences", () => {
  beforeEach(() => localStorage.clear());

  it("switches the application to Arabic RTL and shows Arabic business names", async () => {
    mockApi({ "GET /api/applications": () => ({ sampleData: true, items: [{ id: "app-1", businessName: "Al Nakhil Packaging", businessNameArabic: "تغليف النخيل", commercialRegistration: "1010842763", product: "working_capital", amountSar: 1850000, stage: "decision_required", receivedAt: "2026-11-04T08:20:00.000Z", city: "Riyadh", riskGrade: "B" }] }), "GET /api/applications/app-1/assessment-runs": () => ({ items: [], simulatedData: true }) });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Switch to Arabic" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "rtl"));
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(screen.getByRole("heading", { name: "قائمة الطلبات" })).toBeInTheDocument();
    expect(screen.getAllByText("تغليف النخيل").length).toBeGreaterThan(0);
    expect(localStorage.getItem("rasikh-locale")).toBe("ar");
  });

  it("shows an Arabic badge for every application stage", async () => {
    const stages = [
      ["new", "جديد"],
      ["eligibility_review", "مراجعة الأهلية"],
      ["credit_assessment", "التقييم الائتماني"],
      ["decision_required", "بانتظار القرار"],
      ["referred", "محال للمراجعة"],
    ] as const;
    mockApi({
      "GET /api/applications": () => ({
        sampleData: true,
        items: stages.map(([stage], index) => ({
          id: `app-${index}`,
          businessName: `Sample business ${index + 1}`,
          businessNameArabic: `منشأة تجريبية ${index + 1}`,
          commercialRegistration: `101084276${index}`,
          product: "working_capital",
          amountSar: 1_000_000,
          stage,
          receivedAt: "2026-11-04T08:20:00.000Z",
          city: "Riyadh",
        })),
      }),
      "GET /api/applications/app-0/assessment-runs": () => ({ items: [], simulatedData: true }),
    });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Switch to Arabic" }));

    for (const [, label] of stages) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("switches to the analyst dark theme and persists the choice", async () => {
    mockApi({ "GET /api/applications": () => ({ sampleData: false, items: [] }) });
    renderAt("/");
    const toggle = await screen.findByRole("button", { name: "Use dark theme" });
    await userEvent.click(toggle);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("rasikh-theme")).toBe("dark");
  });
});
