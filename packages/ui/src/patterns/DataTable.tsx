import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "../cx.ts";
import { Skeleton } from "../primitives/Skeleton.tsx";
import styles from "./DataTable.module.css";
import { EmptyState, ErrorState } from "./States.tsx";

export interface Column<Row> {
  /** Unique within the table. */
  key: string;
  header: ReactNode;
  /** The cell. Defaults to row[key] as text. */
  render?: (row: Row) => ReactNode;
  align?: "start" | "end" | "center";
  /** Any CSS width: "120px", "30%". */
  width?: string;
  /** Hide the column on narrow screens, to keep the table readable on a phone. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<Row> {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** What the table lists, for screen readers: "Tickets". */
  caption: string;
  /** Makes rows clickable and keyboard-focusable (Enter opens). */
  onRowClick?: (row: Row) => void;
  /** Shows skeleton rows. */
  loading?: boolean;
  /** Shows an error state in place of the rows; pass onRetry to offer a retry. */
  error?: string | null;
  onRetry?: () => void;
  /** Shown when there are no rows. */
  empty?: ReactNode;
  isRowSelected?: (row: Row) => boolean;
  className?: string;
}

/**
 * A dense, readable table: sticky header, aligned numbers, hover and selection, and built-in loading, empty and
 * error states. Give each column a render() for anything richer than text: a Badge, a name with a sub-line.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  loading = false,
  error = null,
  onRetry,
  empty,
  isRowSelected,
  className,
}: DataTableProps<Row>) {
  const body = () => {
    if (error) {
      return (
        <tr>
          <td colSpan={columns.length} className={styles.state}>
            <ErrorState message={error} onRetry={onRetry} compact />
          </td>
        </tr>
      );
    }
    if (loading && rows.length === 0) {
      return Array.from({ length: 4 }, (_, index) => (
        <tr key={`skeleton-${index}`} aria-hidden="true">
          {columns.map((column) => (
            <td key={column.key} className={cx(column.hideOnMobile && styles.hideOnMobile)}>
              <Skeleton width={index % 2 ? "70%" : "85%"} />
            </td>
          ))}
        </tr>
      ));
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className={styles.state}>
            {empty ?? <EmptyState title="Nothing here yet" compact />}
          </td>
        </tr>
      );
    }
    return rows.map((row) => {
      const open = onRowClick ? () => onRowClick(row) : undefined;
      const onKeyDown = open
        ? (event: KeyboardEvent<HTMLTableRowElement>) => {
            // Only the row itself: Enter on a button inside the row is that button's.
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          }
        : undefined;
      return (
        <tr
          key={rowKey(row)}
          className={cx(open && styles.clickable, isRowSelected?.(row) && styles.selected)}
          onClick={open}
          onKeyDown={onKeyDown}
          tabIndex={open ? 0 : undefined}
          aria-selected={isRowSelected ? isRowSelected(row) : undefined}
        >
          {columns.map((column) => (
            <td key={column.key} className={cx(styles[column.align ?? "start"], column.hideOnMobile && styles.hideOnMobile)}>
              {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "")}
            </td>
          ))}
        </tr>
      );
    });
  };

  return (
    <div className={cx(styles.wrapper, className)}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cx(styles[column.align ?? "start"], column.hideOnMobile && styles.hideOnMobile)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body()}</tbody>
      </table>
    </div>
  );
}

/** A cell with a bold first line and a muted second one: a name and an email, a title and a reference. */
export function CellStack({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className={styles.cellStack}>
      <span className={styles.primary}>{primary}</span>
      {secondary && <span className={styles.secondary}>{secondary}</span>}
    </div>
  );
}
