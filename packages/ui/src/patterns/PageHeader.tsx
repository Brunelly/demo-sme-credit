import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  title: ReactNode;
  /** A line of context under the title: what the page is for, or the record's id and who raised it. */
  description?: ReactNode;
  /** The page's main actions, at the right. */
  actions?: ReactNode;
}

/**
 * The top of a page: its one h1, a line of context, and its main actions. There is deliberately no small label above
 * the title (an "eyebrow"): the title carries the page, and an id or section name belongs in the description.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
