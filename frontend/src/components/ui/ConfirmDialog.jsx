// Asks before deleting a book. Cancel has the focus when it opens (initialFocus), not the X button.
//   book      = the book to delete, or null when closed
//   onClose   = only resets the dialog state
//   onDeleted = called after a successful DELETE, onGone = the book no longer exists (404)
// While the DELETE runs the dialog is "busy": Escape, backdrop click and the X button do nothing.
import { useRef, useState } from "react";
import api, { getApiError } from "../../api/client.js";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import ErrorBox from "./ErrorBox.jsx";

export default function ConfirmDialog({ book, onClose, onDeleted, onGone, getReturnFocus }) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={Boolean(book)}
      onClose={onClose}
      title={book ? `Delete ${book.title}?` : ""}
      initialFocus="[data-initial-focus]"
      getReturnFocus={getReturnFocus}
      busy={busy}
    >
      {book && <DeleteBody book={book} onBusyChange={setBusy} onDeleted={onDeleted} onGone={onGone} />}
    </Modal>
  );
}

// Separate component, so its error state starts fresh every time the dialog opens
function DeleteBody({ book, onBusyChange, onDeleted, onGone }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const sendingRef = useRef(false); // blocks a second click before the state has updated

  function setBusy(value) {
    sendingRef.current = value;
    setSending(value);
    onBusyChange(value);
  }

  async function handleDelete() {
    if (sendingRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/books/${book.id}`);
      setBusy(false);
      onDeleted(book);
    } catch (err) {
      setBusy(false);
      if (err.response?.status === 404) onGone(book);
      else setError(getApiError(err));
    }
  }

  return (
    <div className="mt-2">
      <p className="text-muted">This cannot be undone.</p>
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
        <Button variant="danger" loading={sending} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
