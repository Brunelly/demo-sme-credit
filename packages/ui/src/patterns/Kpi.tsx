import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import { Skeleton } from "../primitives/Skeleton.tsx";
import styles from "./Kpi.module.css";

export interface KpiDelta {
  /** As people read it: "+12%", "3 since Monday". */
  label: string;
  direction: "up" | "down" | "flat";
  /** Whether this direction is good news. Colours the delta: an error rate going up is bad. */
  good?: boolean;
}

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  delta?: KpiDelta;
  /** A line of context under the value. */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Draws attention to a number that needs action. */
  tone?: "default" | "attention";
  loading?: boolean;
}

/** One headline number. Put several in a KpiGrid. Never show a made-up figure: show loading or "—" instead. */
export function KpiTile({ label, value, delta, hint, icon, tone = "default", loading = false }: KpiTileProps) {
  const DeltaIcon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className={cx(styles.tile, tone === "attention" && styles.attention)}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>{loading ? <Skeleton width="56px" height="28px" /> : value}</div>
      {delta && !loading && (
        <span className={cx(styles.delta, delta.good === undefined ? styles.neutral : delta.good ? styles.good : styles.bad)}>
          <DeltaIcon size={14} aria-hidden="true" />
          {delta.label}
        </span>
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** A row of KPI tiles that wraps to fit. */
export function KpiGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {children}
    </div>
  );
}
