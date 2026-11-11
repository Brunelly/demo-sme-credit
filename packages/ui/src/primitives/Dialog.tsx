import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "../cx.ts";
import { Button } from "./Button.tsx";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  /** Called on Escape, the close button and a click on the backdrop. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** The buttons: the main action last. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

/**
 * A modal on the native <dialog>: focus is trapped and Escape closes it, for free. Put a form inside and its
 * submit button in `footer` with form="…", or the whole form in children.
 */
export function Dialog({ open, onClose, title, description, footer, size = "md", children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size])}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" icon={<X size={16} />} aria-label="Close" onClick={onClose} />
          </header>
          {children && <div className={styles.body}>{children}</div>}
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
