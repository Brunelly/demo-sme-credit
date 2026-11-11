import { AppShell, topBarLinkClass } from "@app/ui";
import { NavLink, Outlet } from "react-router";
import { Languages, Moon, Sun } from "lucide-react";
import { usePreferences } from "../lib/preferences.tsx";
import styles from "./RootLayout.module.css";

/** The frame around every page. Add a top-bar link here for each new top-level page. */
export function RootLayout() {
  const { locale, setLocale, theme, setTheme, t } = usePreferences();
  return (
    <AppShell
      brand={{ name: t("Rasikh Bank"), product: t("SME Credit Desk") }}
      skipLabel={locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      nav={
        <>
          <NavLink to="/" end className={topBarLinkClass}>
            {t("Applications")}
          </NavLink>
          <NavLink to="/reviews" className={topBarLinkClass}>
            {t("Review queue")}
          </NavLink>
          <NavLink to="/dashboard" className={topBarLinkClass}>
            {t("Team throughput")}
          </NavLink>
          {import.meta.env.DEV && (
            <NavLink to="/kit" className={topBarLinkClass}>
              {t("UI kit")}
            </NavLink>
          )}
        </>
      }
      actions={
        <div className={styles.switches}>
          <button className={styles.switch} type="button" onClick={() => setLocale(locale === "en" ? "ar" : "en")} aria-label={locale === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}>
            <Languages size={16} aria-hidden="true" />
            <span>{locale === "en" ? "العربية" : "English"}</span>
          </button>
          <button className={styles.switch} type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? t("Use dark theme") : t("Use light theme")} aria-pressed={theme === "dark"}>
            {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            <span>{theme === "light" ? (locale === "ar" ? "داكن" : "Dark") : locale === "ar" ? "فاتح" : "Light"}</span>
          </button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
