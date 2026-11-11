import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "../cx.ts";
import styles from "./Field.module.css";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: ReactNode;
  /** Help under the control. Hidden while there is an error. */
  hint?: ReactNode;
  /** The validation message. Marks the control invalid. */
  error?: ReactNode;
  /** Shows "Optional" next to the label. */
  optional?: boolean;
  className?: string;
  /** One Input, Textarea or Select: the Field wires up its id, label and messages. */
  children: ReactNode;
}

/**
 * A labelled form control with its hint and error.
 *
 *   <Field label="Title" error={errors.title}><Input value={title} onChange={…} /></Field>
 */
export function Field({ label, hint, error, optional = false, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}>Optional</span>}
      </label>
      <FieldContext.Provider value={{ id, describedBy: message ? messageId : undefined, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {message && (
        <p id={messageId} className={cx(styles.message, error ? styles.error : undefined)} role={error ? "alert" : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}

/** Props a control takes from the Field it sits in (its own props win). */
function useFieldProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] }) {
  const field = useContext(FieldContext);
  return {
    id: props.id ?? field?.id,
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid ? true : undefined),
  };
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(styles.control, className)} {...props} {...useFieldProps(props)} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(styles.control, styles.textarea, className)} rows={rows} {...props} {...useFieldProps(props)} />;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "children"> {
  options: readonly SelectOption[];
}

export function Select({ className, options, ...props }: SelectProps) {
  return (
    <select className={cx(styles.control, styles.select, className)} {...props} {...useFieldProps(props)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
