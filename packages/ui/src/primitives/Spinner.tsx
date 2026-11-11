import { cx } from "../cx.ts";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  /** Pixels. */
  size?: number;
  /** For screen readers. Leave it out when the spinner sits inside something that already says it's busy. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 16, label, className }: SpinnerProps) {
  return (
    <span
      className={cx(styles.spinner, className)}
      style={{ width: size, height: size }}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
