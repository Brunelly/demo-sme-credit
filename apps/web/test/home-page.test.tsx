import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { brand } from "../src/brand.ts";
import { mockApi, renderAt } from "./helpers.tsx";

describe("the starter app", () => {
  it("opens on a blank home page in the app's frame, and calls nothing", async () => {
    const api = mockApi({});
    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: `${brand.name} ${brand.product}` })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent(brand.name);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it("explains a page that doesn't exist and goes back home", async () => {
    mockApi({});
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
