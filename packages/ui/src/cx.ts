/** Joins class names, skipping false, null and undefined: cx(styles.row, selected && styles.selected). */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
