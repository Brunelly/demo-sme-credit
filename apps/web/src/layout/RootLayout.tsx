import { AppShell, topBarLinkClass } from "@app/ui";
import { NavLink, Outlet } from "react-router";
import { brand } from "../brand.ts";

/** The frame around every page. Add a top-bar link here for each new top-level page. */
export function RootLayout() {
  return (
    <AppShell
      brand={brand}
      nav={
        import.meta.env.DEV ? (
          <NavLink to="/kit" className={topBarLinkClass}>
            UI kit
          </NavLink>
        ) : undefined
      }
    >
      <Outlet />
    </AppShell>
  );
}
