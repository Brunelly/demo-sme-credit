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
    mockApi({ "GET /api/applications": () => applications });
    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Application queue" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("SME Credit Desk");
    expect(screen.getByRole("columnheader", { name: "Amount (SAR)" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Al Nakhil Packaging" })).toBeInTheDocument();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("selects another queue row and updates the case workspace", async () => {
    mockApi({ "GET /api/applications": () => applications });
    renderAt("/");

    await userEvent.click(await screen.findByText("Rawafid Industrial Supplies"));
    const workspace = screen.getByRole("complementary", { name: "Selected application workspace" });
    expect(workspace).toHaveTextContent("Rawafid Industrial Supplies");
    expect(workspace).toHaveTextContent("Credit analyst reviews flagged checks");
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
