import { cx } from "../cx.ts";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
}

/** A person's initials. Never invent a photo. */
export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span className={cx(styles.avatar, styles[size], className)} title={name} aria-label={name} role="img">
      {initials(name)}
    </span>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase();
}
