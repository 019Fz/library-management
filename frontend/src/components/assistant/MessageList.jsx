// The scrolling conversation: question bubbles, answer cards, errors, the "Thinking..." row,
// and the welcome text with example chips when nothing has been asked yet.
import { useEffect, useRef } from "react";
import AnswerCard from "./AnswerCard.jsx";
import Chips from "./Chips.jsx";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";

const NEAR_BOTTOM_PX = 80;

export default function MessageList({ messages, busy, expanded, chips, onAsk, onRetry }) {
  const listRef = useRef(null);
  // Is the reader at (or near) the bottom? Only then do new messages scroll into view.
  const nearBottom = useRef(true);

  function handleScroll() {
    const el = listRef.current;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  // Scroll to the newest message when the reader is near the bottom (or just sent a question).
  // This never moves focus. Reduced motion gets an instant jump.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const sentByUser = messages.at(-1)?.role === "user";
    if (!nearBottom.current && !sentByUser) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages, busy]);

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      tabIndex={0}
      aria-label="Conversation"
      className="min-h-0 flex-1 overflow-y-auto bg-surface p-3 focus-ring"
    >
      {messages.length === 0 && !busy && (
        <div className="py-2">
          <p className="text-sm text-ink">
            Hi! Ask me about your library: totals, genres, authors, prices or reading status.
          </p>
          <div className="mt-3">
            <Chips items={chips} onPick={onAsk} label="Example questions" />
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {messages.map((message) => (
          <li key={message.id} className={message.role === "user" ? "flex justify-end" : ""}>
            {message.role === "user" && (
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-card bg-ink px-3 py-2 text-sm text-on-ink">
                {message.text}
              </p>
            )}
            {message.reply && <AnswerCard reply={message.reply} expanded={expanded} busy={busy} onAsk={onAsk} />}
            {message.error && (
              <div className="rounded-card border border-danger bg-danger-soft p-3 text-sm text-danger">
                <p className="flex items-start gap-2 font-medium">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words">{message.error.message}</span>
                </p>
                {message.error.retryable && (
                  <Button
                    size="sm"
                    variant="outlined"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => onRetry(message.id, message.error.question)}
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
        {busy && (
          <li className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true" className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse" />
              <span className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse [animation-delay:300ms]" />
            </span>
            Thinking...
          </li>
        )}
      </ul>
    </div>
  );
}
