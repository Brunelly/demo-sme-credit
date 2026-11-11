import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./AppShell.module.css";

export interface AppBrand {
  /** The organisation, shown bold: "Acme". */
  name: string;
  /** The product, after a divider: "Operations". */
  product?: string;
  /** A logo. Defaults to the name's first letter on a brand-coloured square. */
  mark?: ReactNode;
}

export interface AppShellProps {
  brand: AppBrand;
  /** Top-bar links: router links with className={topBarLinkClass}. */
  nav?: ReactNode;
  /** The right of the top bar: the user, a help link. */
  actions?: ReactNode;
  children: ReactNode;
}

/** The frame every page sits in: a top bar (brand, navigation, actions) over the page content. */
export function AppShell({ brand, nav, actions, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            {brand.mark ?? brand.name.slice(0, 1)}
          </span>
          <b className={styles.name}>{brand.name}</b>
          {brand.product && <span className={styles.product}>{brand.product}</span>}
        </div>
        {nav && (
          <nav className={styles.nav} aria-label="Main">
            {nav}
          </nav>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}

/**
 * The class for a top-bar link. Fits React Router's NavLink: <NavLink to="/" end className={topBarLinkClass}>.
 */
export function topBarLinkClass({ isActive }: { isActive: boolean }): string {
  return cx(styles.link, isActive && styles.active);
}
