import { CircleAlert, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import { Button } from "../primitives/Button.tsx";
import { Skeleton } from "../primitives/Skeleton.tsx";
import { Spinner } from "../primitives/Spinner.tsx";
import styles from "./States.module.css";

// Every view that loads data shows one of three states before (or instead of) its content: loading, empty, or an
// error. Use these rather than a bare "Loading…" or nothing at all.

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** What to do about it: usually a primary Button ("New ticket"). */
  action?: ReactNode;
  /** Less padding, for inside a card or a table. */
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cx(styles.state, compact && styles.compact)}>
      <span className={styles.icon} aria-hidden="true">
        {icon ?? <Inbox size={20} />}
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export interface LoadingStateProps {
  /** Said to screen readers, and shown under the spinner. */
  label?: string;
  /** Skeleton lines instead of a spinner, for content whose shape is known. */
  lines?: number;
  compact?: boolean;
}

export function LoadingState({ label = "Loading", lines, compact = false }: LoadingStateProps) {
  if (lines) {
    return (
      <div className={styles.lines} role="status" aria-label={label}>
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} width={index === lines - 1 ? "60%" : "100%"} />
        ))}
      </div>
    );
  }
  return (
    <div className={cx(styles.state, compact && styles.compact)} role="status">
      <Spinner size={20} />
      <p className={styles.description}>{label}…</p>
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  /** What went wrong, in words a person can act on. */
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, retryLabel = "Try again", compact = false }: ErrorStateProps) {
  return (
    <div className={cx(styles.state, styles.error, compact && styles.compact)} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <CircleAlert size={20} />
      </span>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{message}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
