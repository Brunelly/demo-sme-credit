import type { CSSProperties, ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./Layout.module.css";

/** A step on the spacing scale (tokens.css --space-N). */
export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

const space = (step: Space) => `var(--space-${step})`;

export interface StackProps {
  gap?: Space;
  /** Default column. */
  direction?: "row" | "column";
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
  className?: string;
  children: ReactNode;
}

/** Children in a row or column with even gaps. Most layout needs nothing more. */
export function Stack({ gap = 4, direction = "column", align, justify, wrap = false, className, children }: StackProps) {
  return (
    <div
      className={cx(styles.stack, className)}
      style={{ gap: space(gap), flexDirection: direction, alignItems: align, justifyContent: justify, flexWrap: wrap ? "wrap" : undefined }}
    >
      {children}
    </div>
  );
}

export interface GridProps {
  /**
   * A number of equal columns, or any grid-template-columns value ("2fr 1fr"). Columns stack on narrow screens.
   * With `minColumnWidth` instead, as many columns fit as can (KPI rows, card grids).
   */
  columns?: number | string;
  minColumnWidth?: string;
  gap?: Space;
  className?: string;
  children: ReactNode;
}

export function Grid({ columns, minColumnWidth, gap = 4, className, children }: GridProps) {
  const template = minColumnWidth
    ? `repeat(auto-fit, minmax(min(${minColumnWidth}, 100%), 1fr))`
    : typeof columns === "number"
      ? `repeat(${columns}, minmax(0, 1fr))`
      : (columns ?? "minmax(0, 1fr)");
  return (
    <div
      className={cx(styles.grid, !minColumnWidth && styles.collapse, className)}
      style={{ gap: space(gap), "--grid-columns": template } as CSSProperties}
    >
      {children}
    </div>
  );
}
