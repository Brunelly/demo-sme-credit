import { cx } from "../cx.ts";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** Any CSS length. Default 100%. */
  width?: string | number;
  /** Default 1em: a line of text. */
  height?: string | number;
  rounded?: boolean;
  className?: string;
}

/** A grey placeholder in the shape of content that is loading. Prefer it to a spinner when the layout is known. */
export function Skeleton({ width = "100%", height = "1em", rounded = false, className }: SkeletonProps) {
  return (
    <span
      className={cx(styles.skeleton, rounded && styles.rounded, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
