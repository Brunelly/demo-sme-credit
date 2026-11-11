import { cx } from "../cx.ts";
import styles from "./FilterChips.module.css";

export interface FilterChipOption<Value extends string> {
  value: Value;
  label: string;
  /** Shown after the label, e.g. how many rows match. */
  count?: number;
}

export interface FilterChipsProps<Value extends string> {
  options: readonly FilterChipOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** What the chips filter, for screen readers: "Filter tickets by status". */
  label: string;
  className?: string;
}

/** One-of-many filter pills above a table or list. */
export function FilterChips<Value extends string>({ options, value, onChange, label, className }: FilterChipsProps<Value>) {
  return (
    <div className={cx(styles.chips, className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx(styles.chip, option.value === value && styles.selected)}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <>
              {" "}
              <span className={styles.count}>{option.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
