// The floating assistant: a round launcher (bottom right) and a non-modal chat panel.
// Mounted once in AppLayout. Phones: a full-width sheet. From "sm": a box above the launcher.
import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.jsx";
import AssistantInput from "./AssistantInput.jsx";
import Chips from "./Chips.jsx";
import MessageList from "./MessageList.jsx";
import { useAssistant } from "../../context/useAssistant.js";
import { chipsToShow } from "../../lib/assistant.js";

const PANEL_ID = "assistant-panel";
const TITLE_ID = "assistant-title";

const HEADER_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface focus-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

// hidden = the mobile menu drawer is open, so the launcher steps out of its way
export default function AssistantWidget({ hidden = false }) {
  const { open, expanded, messages, examples, busy, cooldownUntil, send, retry, clear, close, toggleOpen, setExpanded } =
    useAssistant();
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const returnFocus = useRef(false);
  const [announcement, setAnnouncement] = useState("");

  // Opening puts the cursor in the question box
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // After closing, focus goes back to the launcher (on phones it is hidden while open, so this waits for the re-render)
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  // Screen readers hear only the summary sentence (or the error text) of the newest answer.
  // The region is emptied first, so two identical answers in a row are still announced.
  const last = messages.at(-1);
  const lastId = last?.role === "assistant" ? last.id : null;
  const spoken = last?.role === "assistant" ? (last.reply?.answer?.summary ?? last.error?.message ?? "") : "";
  useEffect(() => {
    const clearTimer = setTimeout(() => setAnnouncement(""), 0);
    const speakTimer = lastId && spoken ? setTimeout(() => setAnnouncement(spoken), 60) : null;
    return () => {
      clearTimeout(clearTimer);
      clearTimeout(speakTimer);
    };
  }, [lastId, spoken]);

  // Closing is ignored while a question is running
  function handleClose() {
    if (busy) return;
    returnFocus.current = true;
    close();
  }

  function handleLauncher() {
    if (busy) return;
    if (open) returnFocus.current = true;
    toggleOpen();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      handleClose();
    }
  }

  // Ask a question and keep the cursor in the box (chips and suggestions use this too)
  function ask(question) {
    send(question);
    inputRef.current?.focus();
  }

  function handleClear() {
    clear();
    inputRef.current?.focus();
  }

  const chips = chipsToShow({ examples, messages, busy });

  return (
    <>
      {open && (
        <div
          id={PANEL_ID}
          role="dialog"
          aria-modal="false"
          aria-labelledby={TITLE_ID}
          onKeyDown={handleKeyDown}
          className={`fixed inset-x-0 bottom-0 z-20 flex h-[85dvh] flex-col overflow-hidden rounded-t-card border border-line bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-24 sm:h-auto sm:max-h-[70vh] sm:min-h-[24rem] sm:rounded-card sm:pb-0 ${
            expanded ? "sm:w-[min(48rem,calc(100vw-2rem))]" : "sm:w-96"
          }`}
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-1">
            <h2 id={TITLE_ID} className="mr-auto text-base font-semibold text-ink">
              Library assistant
            </h2>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse assistant" : "Expand assistant"}
              className={`${HEADER_BUTTON} max-sm:hidden`}
            >
              <Icon name={expanded ? "collapse" : "expand"} />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={messages.length === 0}
              aria-label="Clear conversation"
              title="Clear conversation"
              className={`${HEADER_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Icon name="trash" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-disabled={busy || undefined}
              aria-label="Close assistant"
              className={HEADER_BUTTON}
            >
              <Icon name="close" />
            </button>
          </div>

          <MessageList
            messages={messages}
            busy={busy}
            expanded={expanded}
            chips={chips}
            onAsk={ask}
            onRetry={retry}
          />

          {/* Once the conversation has started, the examples shrink to one short row above the input */}
          {messages.length > 0 && chips.length > 0 && (
            <div className="shrink-0 border-t border-line bg-card px-3 pt-2">
              <Chips items={chips} onPick={ask} label="Example questions" />
            </div>
          )}

          <AssistantInput inputRef={inputRef} busy={busy} cooldownUntil={cooldownUntil} onSend={send} />

          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {announcement}
          </p>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={handleLauncher}
        aria-label={open ? "Close library assistant" : "Open library assistant"}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-disabled={(open && busy) || undefined}
        className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg hover:bg-accent-hover focus-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${
          open ? "max-sm:hidden" : ""
        } ${hidden ? "max-lg:hidden" : ""}`}
      >
        <Icon name={open ? "close" : "chat"} className="h-6 w-6" />
      </button>
    </>
  );
}
