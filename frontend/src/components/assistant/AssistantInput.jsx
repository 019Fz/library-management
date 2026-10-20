// The question box: a labelled textarea with a counter and a Send button.
// Enter sends, Shift+Enter makes a new line. Focus stays in the box after sending.
import { useEffect, useState } from "react";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import { MAX_QUESTION_LENGTH } from "../../lib/assistant.js";

// Shown only while the rate limit runs; it is mounted fresh each time, so its clock starts correct
function CooldownNote({ until }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(1, Math.ceil((until - now) / 1000));
  return <p className="text-xs text-muted">You can ask again in {seconds} s.</p>;
}

export default function AssistantInput({ inputRef, busy, cooldownUntil, onSend }) {
  const [draft, setDraft] = useState("");
  const cooling = cooldownUntil > 0;
  const canSend = draft.trim() !== "" && !busy && !cooling;

  function submit() {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    // Enter sends; Shift+Enter is a new line; Enter while composing text (IME) is left alone
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 border-t border-line bg-card p-3"
    >
      <label htmlFor="assistant-question" className="sr-only">
        Ask a question about the library
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="assistant-question"
          ref={inputRef}
          rows={2}
          maxLength={MAX_QUESTION_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          className="min-h-11 flex-1 resize-none rounded-field border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus-ring"
        />
        <Button type="submit" disabled={!canSend} aria-label="Send question" className="h-11 w-11 shrink-0 px-0!">
          <Icon name="send" />
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        {cooling ? <CooldownNote until={cooldownUntil} /> : <span />}
        <p className={`text-xs ${draft.length >= MAX_QUESTION_LENGTH ? "text-danger" : "text-muted"}`}>
          {draft.length} / {MAX_QUESTION_LENGTH}
        </p>
      </div>
    </form>
  );
}
