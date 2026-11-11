import { CircleCheck, CircleX, Info, Sparkles, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./Alert.module.css";

export type AlertTone = "info" | "success" | "warning" | "danger" | "ai";

const ICONS: Record<AlertTone, ReactNode> = {
  info: <Info size={16} />,
  success: <CircleCheck size={16} />,
  warning: <TriangleAlert size={16} />,
  danger: <CircleX size={16} />,
  ai: <Sparkles size={16} />,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** A button or link at the right. */
  action?: ReactNode;
  /**
   * No box: just the icon and the words, for an alert that sits on a card's own surface (a composer's footer, a
   * panel). A boxed alert inside a card is a card inside a card.
   */
  flush?: boolean;
  className?: string;
}

/** An inline message inside a page or card: a warning, a result, "AI not connected". Not for toasts. */
export function Alert({ tone = "info", title, children, action, flush = false, className }: AlertProps) {
  return (
    <div className={cx(styles.alert, styles[tone], flush && styles.flush, className)} role={tone === "danger" ? "alert" : "status"}>
      <span className={styles.icon} aria-hidden="true">
        {ICONS[tone]}
      </span>
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
