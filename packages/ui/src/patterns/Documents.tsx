import { File as FileIcon, FileImage, FileSpreadsheet, FileText, Trash2, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cx } from "../cx.ts";
import { Badge } from "../primitives/Badge.tsx";
import { Button } from "../primitives/Button.tsx";
import { EmptyState, LoadingState } from "./States.tsx";
import styles from "./Documents.module.css";

// Upload, list and preview documents. These are the browser half only: send the File objects to an API route
// (multipart/form-data) to store them, and show the server's status per document in DocumentList.

export interface RejectedFile {
  file: File;
  reason: string;
}

export interface DocumentDropzoneProps {
  onFiles: (files: File[]) => void;
  /** Files refused for their type or size, with why. Show the reasons to the person. */
  onReject?: (rejected: RejectedFile[]) => void;
  /** Like <input accept>: ".pdf,.docx,image/*". */
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  title?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** A drop area that also opens the file picker on click, Enter or Space. */
export function DocumentDropzone({
  onFiles,
  onReject,
  accept,
  multiple = true,
  maxSizeBytes,
  title = "Drop documents here",
  description = "or click to choose files",
  disabled = false,
  className,
}: DocumentDropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [dragging, setDragging] = useState(false);

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const accepted: File[] = [];
    const rejected: RejectedFile[] = [];
    for (const file of Array.from(list).slice(0, multiple ? undefined : 1)) {
      if (accept && !matchesAccept(file, accept)) rejected.push({ file, reason: `${file.name} isn't a type this accepts.` });
      else if (maxSizeBytes && file.size > maxSizeBytes) rejected.push({ file, reason: `${file.name} is over ${formatBytes(maxSizeBytes)}.` });
      else accepted.push(file);
    }
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onReject?.(rejected);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files);
  };

  return (
    <div
      className={cx(styles.dropzone, dragging && styles.dragging, disabled && styles.disabled, className)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-describedby={descriptionId}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <span className={styles.dropIcon} aria-hidden="true">
        <Upload size={18} />
      </span>
      <span className={styles.dropTitle}>{title}</span>
      <span id={descriptionId} className={styles.dropDescription}>
        {description}
        {maxSizeBytes ? ` · up to ${formatBytes(maxSizeBytes)}` : ""}
      </span>
      <input
        ref={input}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        data-testid="document-input"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export type DocumentStatus = "uploading" | "reading" | "ready" | "failed";

export interface DocumentItem {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** The MIME type. */
  type: string;
  status?: DocumentStatus;
  /** 0–100, while uploading. */
  progress?: number;
  /** Why it failed. */
  error?: string;
}

const STATUS: Record<DocumentStatus, { label: string; tone: "info" | "ai" | "success" | "danger" }> = {
  uploading: { label: "Uploading", tone: "info" },
  reading: { label: "Reading", tone: "ai" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export interface DocumentListProps {
  documents: readonly DocumentItem[];
  selectedId?: string | null;
  onSelect?: (document: DocumentItem) => void;
  onRemove?: (document: DocumentItem) => void;
  empty?: ReactNode;
}

/** Documents with their type, size and status (uploading → reading → ready, or failed). */
export function DocumentList({ documents, selectedId, onSelect, onRemove, empty }: DocumentListProps) {
  if (documents.length === 0) return <>{empty ?? null}</>;
  return (
    <ul className={styles.list}>
      {documents.map((item) => {
        const status = item.status ? STATUS[item.status] : undefined;
        return (
          <li key={item.id} className={cx(styles.item, item.id === selectedId && styles.selected)}>
            <button
              type="button"
              className={styles.itemMain}
              onClick={() => onSelect?.(item)}
              aria-current={item.id === selectedId || undefined}
              disabled={!onSelect}
            >
              <span className={styles.fileIcon} aria-hidden="true">
                <DocumentIcon type={item.type} name={item.name} />
              </span>
              <span className={styles.fileText}>
                <span className={styles.fileName}>{item.name}</span>
                <span className={styles.fileMeta}>
                  {formatBytes(item.size)}
                  {item.error && <span className={styles.fileError}> · {item.error}</span>}
                </span>
              </span>
            </button>
            {status && (
              <Badge tone={status.tone} dot>
                {status.label}
                {item.status === "uploading" && item.progress !== undefined ? ` ${Math.round(item.progress)}%` : ""}
              </Badge>
            )}
            {onRemove && (
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DocumentIcon({ type, name }: { type: string; name: string }) {
  if (type.startsWith("image/")) return <FileImage size={18} />;
  if (type.includes("spreadsheet") || type === "text/csv" || /\.(xlsx?|csv)$/i.test(name)) return <FileSpreadsheet size={18} />;
  if (type.startsWith("text/") || type === "application/pdf" || /\.(pdf|docx?|md|txt)$/i.test(name)) return <FileText size={18} />;
  return <FileIcon size={18} />;
}

export interface DocumentPreviewProps {
  /** A File picked in the browser, or a document the server stores (its URL). Null shows the empty state. */
  source: File | { name: string; type: string; url: string } | null;
  /** Characters of a text file to show. */
  maxTextLength?: number;
  className?: string;
}

/** Shows a document: images and PDFs inline, text files as text, anything else as its name and type. */
export function DocumentPreview({ source, maxTextLength = 20_000, className }: DocumentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const isFile = typeof File !== "undefined" && source instanceof File;
  const type = source?.type ?? "";
  const isText = type.startsWith("text/") || type === "application/json";

  useEffect(() => {
    setText(null);
    setUrl(null);
    if (!source) return;
    if (!isFile) {
      setUrl((source as { url: string }).url);
      return;
    }
    const file = source as File;
    if (isText) {
      let cancelled = false;
      void file.text().then((content) => {
        if (!cancelled) setText(content.slice(0, maxTextLength));
      });
      return () => {
        cancelled = true;
      };
    }
    if (typeof URL.createObjectURL !== "function") return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [source, isFile, isText, maxTextLength]);

  if (!source) {
    return (
      <div className={cx(styles.preview, className)}>
        <EmptyState title="No document selected" description="Choose a document to preview it here." compact icon={<FileText size={20} />} />
      </div>
    );
  }

  let body: ReactNode;
  if (isText) body = text === null ? <LoadingState lines={6} label="Reading the file" /> : <pre className={styles.text}>{text}</pre>;
  else if (type.startsWith("image/") && url) body = <img className={styles.image} src={url} alt={source.name} />;
  else if (type === "application/pdf" && url) body = <iframe className={styles.frame} src={url} title={source.name} />;
  else body = <EmptyState title="No preview for this type" description={type || "Unknown type"} compact icon={<FileIcon size={20} />} />;

  return (
    <figure className={cx(styles.preview, className)}>
      <figcaption className={styles.caption}>
        <DocumentIcon type={type} name={source.name} />
        <span>{source.name}</span>
      </figcaption>
      <div className={styles.previewBody}>{body}</div>
    </figure>
  );
}

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function matchesAccept(file: File, accept: string): boolean {
  return accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
      if (rule.endsWith("/*")) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
      return file.type.toLowerCase() === rule;
    });
}
