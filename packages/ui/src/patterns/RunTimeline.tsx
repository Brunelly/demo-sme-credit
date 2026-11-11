import { Circle, CircleCheck, CircleMinus, CircleX, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./RunTimeline.module.css";

export type RunStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface RunStep {
  id: string;
  /** What happens in the step: "Read the ticket", "Draft the reply". */
  label: ReactNode;
  status: RunStepStatus;
  /** More about it: the tool's input, a result, why it failed. */
  detail?: ReactNode;
  /** At the right: a duration, a time. */
  meta?: ReactNode;
}

const STATUS_TEXT: Record<RunStepStatus, string> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

function StatusIcon({ status }: { status: RunStepStatus }) {
  switch (status) {
    case "done":
      return <CircleCheck size={16} />;
    case "failed":
      return <CircleX size={16} />;
    case "running":
      return <LoaderCircle size={16} className={styles.spin} />;
    case "skipped":
      return <CircleMinus size={16} />;
    default:
      return <Circle size={16} />;
  }
}

export interface RunTimelineProps {
  steps: readonly RunStep[];
  /** What the run is, for screen readers: "Assistant run". */
  label: string;
  /** Shown when there are no steps. */
  empty?: ReactNode;
  className?: string;
}

/** What an agent run did, step by step, as it happens: tool calls, approvals, the answer. */
export function RunTimeline({ steps, label, empty, className }: RunTimelineProps) {
  if (steps.length === 0) return <>{empty ?? null}</>;
  return (
    <ol className={cx(styles.timeline, className)} aria-label={label}>
      {steps.map((step) => (
        <li key={step.id} className={cx(styles.step, styles[step.status])}>
          <span className={styles.marker} aria-hidden="true">
            <StatusIcon status={step.status} />
          </span>
          <div className={styles.content}>
            <div className={styles.row}>
              <span className={styles.label}>{step.label}</span>
              <span className="visually-hidden">: {STATUS_TEXT[step.status]}</span>
              {step.meta && <span className={styles.meta}>{step.meta}</span>}
            </div>
            {step.detail && <div className={styles.detail}>{step.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
