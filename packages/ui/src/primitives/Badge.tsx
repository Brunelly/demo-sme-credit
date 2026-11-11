import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./Badge.module.css";

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "ai";

export interface BadgeProps {
  tone?: Tone;
  /** A dot before the label: good for statuses in a table. */
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A short status or category label. Map each machine value (a status, a priority) to a tone in one place. */
export function Badge({ tone = "neutral", dot = false, icon, children, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
