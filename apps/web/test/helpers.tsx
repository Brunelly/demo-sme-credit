import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { routes } from "../src/routes.tsx";
import { PreferencesProvider } from "../src/lib/preferences.tsx";

type Handler = (body: unknown, url: URL) => unknown;

/**
 * Stubs fetch with fake API answers, keyed "METHOD /path" (no query string). A handler returns the JSON body;
 * return `status(code, body)` for another status. Unknown requests fail the test loudly.
 *
 *   const api = mockApi({ "GET /api/orders": () => ({ items: [] }) });
 *   expect(api.calls).toContainEqual({ method: "POST", path: "/api/orders", body: {...} });
 */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: { method: string; path: string; search: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, search: url.search, body });
    const handler = handlers[`${method} ${url.pathname}`];
    if (!handler) throw new Error(`No mock for ${method} ${url.pathname}`);
    const result = handler(body, url);
    const { code, payload } = result instanceof StatusResult ? result : { code: 200, payload: result };
    return new Response(code === 204 ? null : JSON.stringify(payload), { status: code, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetch: fetchMock };
}

class StatusResult {
  readonly code: number;
  readonly payload: unknown;
  constructor(code: number, payload: unknown) {
    this.code = code;
    this.payload = payload;
  }
}

export const status = (code: number, payload?: unknown) => new StatusResult(code, payload);

/** Renders the whole app at a path, with the real routes. */
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...render(<PreferencesProvider><RouterProvider router={router} /></PreferencesProvider>) };
}
