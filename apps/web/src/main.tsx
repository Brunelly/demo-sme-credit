import "@app/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes.tsx";
import { PreferencesProvider } from "./lib/preferences.tsx";

const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreferencesProvider><RouterProvider router={router} /></PreferencesProvider>
  </StrictMode>,
);
