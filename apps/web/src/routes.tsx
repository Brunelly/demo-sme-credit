import type { RouteObject } from "react-router";
import { RootLayout } from "./layout/RootLayout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { KitPage } from "./pages/KitPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { RouteError } from "./pages/RouteError.tsx";

/**
 * Every page, by path. The app lives at the site root ("/"), never under a base path, and calls the API at
 * "/api/…". Add a page: a component in pages/, a route here, a top-bar link in layout/RootLayout.tsx if it is
 * top-level, and an entry in poc.json's ui.routes. Never add a route under /api or /__brunelly.
 *
 * /kit shows every component in packages/ui. It exists in development only: people using the app never see it.
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      ...(import.meta.env.DEV ? [{ path: "kit", element: <KitPage /> }] : []),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
