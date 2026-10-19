// Asks before an action (deleting a book or a user, changing a role). Cancel has the focus when it
// opens (initialFocus), not the X button.
//   target     = the thing the action is for, or null when closed
//   title/text = the question and a sentence explaining the consequences
//   confirmLabel, variant = the confirm button ("Delete" + "danger" by default)
//   request    = request(target) returns the axios promise that performs the action
//   onDone     = called with the target after success, onGone = the target no longer exists (404)
//   onClose    = only resets the dialog state
// While the request runs the dialog is "busy": Escape, backdrop click and the X button do nothing.
import { useRef, useState } from "react";
import { getApiError } from "../../api/client.js";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import ErrorBox from "./ErrorBox.jsx";

export default function ConfirmDialog({
  target,
  title,
  text,
  confirmLabel = "Delete",
  variant = "danger",
  request,
  onDone,
  onGone,
  onClose,
  getReturnFocus,
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={target ? title : ""}
      initialFocus="[data-initial-focus]"
      getReturnFocus={getReturnFocus}
      busy={busy}
    >
      {target && (
        <ConfirmBody
          target={target}
          text={text}
          confirmLabel={confirmLabel}
          variant={variant}
          request={request}
          onBusyChange={setBusy}
          onDone={onDone}
          onGone={onGone}
        />
      )}
    </Modal>
  );
}

// Separate component, so its error state starts fresh every time the dialog opens
function ConfirmBody({ target, text, confirmLabel, variant, request, onBusyChange, onDone, onGone }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const sendingRef = useRef(false); // blocks a second click before the state has updated

  function setBusy(value) {
    sendingRef.current = value;
    setSending(value);
    onBusyChange(value);
  }

  async function handleConfirm() {
    if (sendingRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await request(target);
      setBusy(false);
      onDone(target);
    } catch (err) {
      setBusy(false);
      if (err.response?.status === 404) onGone(target);
      else setError(getApiError(err));
    }
  }

  return (
    <div className="mt-2">
      <p className="text-muted">{text}</p>
      {error && (
        <div className="mt-4">
          <ErrorBox message={error.message} details={error.details} />
        </div>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* Closes the surrounding native dialog, which then calls onClose */}
        <Button
          variant="outlined"
          disabled={sending}
          data-initial-focus
          onClick={(event) => event.currentTarget.closest("dialog").close()}
        >
          Cancel
        </Button>
        <Button variant={variant} loading={sending} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
