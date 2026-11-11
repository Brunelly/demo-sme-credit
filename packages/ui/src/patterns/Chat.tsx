import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cx } from "../cx.ts";
import { Button } from "../primitives/Button.tsx";
import styles from "./Chat.module.css";

export type ChatRole = "user" | "assistant" | "notice";

export interface ChatMessage {
  id: string;
  /** user: the person. assistant: the AI (marked as AI-written). notice: the app talking (errors, "not connected"). */
  role: ChatRole;
  content: ReactNode;
  /** A small line under the message: a time, the run it came from. */
  meta?: ReactNode;
  /** Shows a notice as a problem. */
  error?: boolean;
}

export interface ChatThreadProps {
  messages: readonly ChatMessage[];
  /** Shows the "thinking" indicator after the last message. */
  pending?: boolean;
  pendingLabel?: string;
  /** Shown before the first message. */
  empty?: ReactNode;
  className?: string;
}

/** The conversation. Scrolls to the newest message and announces new ones to screen readers. */
export function ChatThread({ messages, pending = false, pendingLabel = "Thinking", empty, className }: ChatThreadProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages.length, pending]);

  return (
    <div className={cx(styles.thread, className)} role="log" aria-live="polite" aria-relevant="additions">
      {messages.length === 0 && !pending && empty}
      {messages.map((message) => (
        <div key={message.id} className={cx(styles.message, styles[message.role], message.error && styles.error)}>
          {message.role === "assistant" && (
            <span className={styles.aiTag}>
              <Sparkles size={11} aria-hidden="true" /> AI
            </span>
          )}
          <div className={styles.bubble}>{message.content}</div>
          {message.meta && <span className={styles.meta}>{message.meta}</span>}
        </div>
      ))}
      {pending && (
        <div className={cx(styles.message, styles.assistant)} role="status">
          <span className={styles.typing} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="visually-hidden">{pendingLabel}</span>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export interface ChatComposerProps {
  onSend: (text: string) => void;
  /** While a reply is coming: the field stays editable, sending waits. */
  pending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** The field's accessible name. */
  label?: string;
  /** Controlled value, e.g. to prefill a question. Leave out for an uncontrolled composer. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** The textarea, e.g. to focus it after prefilling a question. */
  inputRef?: Ref<HTMLTextAreaElement>;
}

/** The message box: Enter sends, Shift+Enter starts a new line. */
export function ChatComposer({
  onSend,
  pending = false,
  disabled = false,
  placeholder = "Ask a question…",
  label = "Message",
  value,
  onValueChange,
  inputRef,
}: ChatComposerProps) {
  const [own, setOwn] = useState("");
  const text = value ?? own;
  const setText = (next: string) => (onValueChange ? onValueChange(next) : setOwn(next));
  const canSend = text.trim().length > 0 && !pending && !disabled;

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
  };

  return (
    <form className={styles.composer} onSubmit={send}>
      <textarea
        ref={inputRef}
        className={styles.input}
        aria-label={label}
        placeholder={placeholder}
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button type="submit" variant="primary" size="sm" icon={<ArrowUp size={16} />} aria-label="Send" disabled={!canSend} loading={pending} />
    </form>
  );
}

export interface SuggestionChipsProps {
  suggestions: readonly string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
}

/** Follow-up questions to ask with one click. */
export function SuggestionChips({ suggestions, onPick, disabled = false }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className={styles.suggestions} role="group" aria-label="Suggested questions">
      {suggestions.map((suggestion) => (
        <button key={suggestion} type="button" className={styles.suggestion} disabled={disabled} onClick={() => onPick(suggestion)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}

export interface AssistantPanelProps {
  title?: ReactNode;
  /** At the right of the header: a Badge saying whether the AI is connected. */
  status?: ReactNode;
  messages: readonly ChatMessage[];
  pending?: boolean;
  onSend: (text: string) => void;
  suggestions?: readonly string[];
  /** Shown before the first message: what the assistant can do. */
  intro?: ReactNode;
  /** Above the composer: an Alert (e.g. "AI not connected"), the record the chat is about. */
  notice?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  /** Prefill the composer (controlled). */
  draft?: string;
  onDraftChange?: (value: string) => void;
  /** The composer's textarea, to focus it. */
  composerRef?: Ref<HTMLTextAreaElement>;
  className?: string;
}

/** A complete assistant: header, conversation, suggestions and composer, in one card-shaped panel. */
export function AssistantPanel({
  title = "Assistant",
  status,
  messages,
  pending = false,
  onSend,
  suggestions = [],
  intro,
  notice,
  placeholder,
  disabled,
  draft,
  onDraftChange,
  composerRef,
  className,
}: AssistantPanelProps) {
  return (
    <section className={cx(styles.panel, className)} aria-label={typeof title === "string" ? title : "Assistant"}>
      <header className={styles.header}>
        <span className={styles.titleRow}>
          <span className={styles.badge} aria-hidden="true">
            <Sparkles size={14} />
          </span>
          <h2 className={styles.title}>{title}</h2>
        </span>
        {status}
      </header>
      <ChatThread messages={messages} pending={pending} empty={intro && <div className={styles.intro}>{intro}</div>} />
      <div className={styles.footer}>
        {notice}
        <SuggestionChips suggestions={suggestions} onPick={onSend} disabled={pending || disabled} />
        <ChatComposer
          onSend={onSend}
          pending={pending}
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onValueChange={onDraftChange}
          inputRef={composerRef}
        />
      </div>
    </section>
  );
}
