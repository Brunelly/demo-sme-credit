import { useId, type ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./Card.module.css";

export interface CardProps {
  title?: ReactNode;
  /** A line under the title, or beside it on wide screens: a count, a sort order, a time. */
  subtitle?: ReactNode;
  /** Buttons or filters at the right of the header. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Pad the body. Turn it off for a table or a list that runs edge to edge. Default true. */
  padded?: boolean;
  /** Draws attention: a soft danger border, for a card that needs action. */
  tone?: "default" | "attention";
  as?: "section" | "div" | "article" | "aside";
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}

/** The surface most content sits on. A card with a title is a labelled section. */
export function Card({
  title,
  subtitle,
  actions,
  footer,
  padded = true,
  tone = "default",
  as: Element = "section",
  className,
  children,
  ...rest
}: CardProps) {
  const titleId = useId();
  const hasHeader = title !== undefined || actions !== undefined;
  const labelledBy = title !== undefined && !rest["aria-label"] ? titleId : undefined;
  return (
    <Element className={cx(styles.card, tone === "attention" && styles.attention, className)} aria-labelledby={labelledBy} {...rest}>
      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.heading}>
            {title !== undefined && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
            {subtitle !== undefined && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          {actions !== undefined && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children !== undefined && <div className={cx(styles.body, padded && styles.padded)}>{children}</div>}
      {footer !== undefined && <footer className={styles.footer}>{footer}</footer>}
    </Element>
  );
}
