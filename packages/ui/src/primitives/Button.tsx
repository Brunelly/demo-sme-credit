import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./Button.module.css";
import { Spinner } from "./Spinner.tsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ComponentProps<"button"> {
  /** primary: the one main action in a view. secondary: everything else. ghost: low-emphasis, in toolbars. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button: set it while the action's request is in flight. */
  loading?: boolean;
  /** An icon before the label, e.g. <Plus size={16} /> from lucide-react. With no label, set aria-label. */
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], !children && styles.iconOnly, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : icon}
      {children !== undefined && children !== null && <span className={styles.label}>{children}</span>}
    </button>
  );
}
