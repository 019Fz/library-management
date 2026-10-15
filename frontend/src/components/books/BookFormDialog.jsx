// One dialog for adding and editing a book.
//   open     = show the dialog; book = the book to edit, or null to add a new one
//   genres   = the user's genres (suggestions for the genre field), or null
//   onClose  = only resets the dialog state (it can be called more than once)
//   onSaved  = called with "added", "updated" or "unchanged" after success
//   onGone   = called when the book no longer exists (404 on edit)
import { useId, useRef, useState } from "react";
import api, { getApiError } from "../../api/client.js";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import FormField from "../ui/FormField.jsx";
import SelectField from "../ui/SelectField.jsx";
import ErrorBox from "../ui/ErrorBox.jsx";
import { CURRENCY, STATUS_LABELS } from "../../lib/format.js";
import { LIMITS, buildPatch, validateBookForm } from "../../lib/bookForm.js";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const FIELD_ORDER = ["title", "author", "genre", "price"];

export default function BookFormDialog({ open, book, genres, onClose, onSaved, onGone, getReturnFocus }) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={book ? "Edit book" : "Add book"}
      initialFocus="#book-title"
      getReturnFocus={getReturnFocus}
      busy={busy}
    >
      {open && <BookForm book={book} genres={genres} onBusyChange={setBusy} onSaved={onSaved} onGone={onGone} />}
    </Modal>
  );
}

// Separate component, so all form state starts fresh every time the dialog opens
function BookForm({ book, genres, onBusyChange, onSaved, onGone }) {
  const [values, setValues] = useState({
    title: book?.title ?? "",
    author: book?.author ?? "",
    genre: book?.genre ?? "",
    price: book ? Number(book.price).toFixed(2) : "",
    status: book?.status ?? "to-read",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null); // message + details from the backend
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // blocks a second submit before the state has updated
  const formRef = useRef(null);
  const genreListId = useId();

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined })); // clear that field's message
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (sendingRef.current) return;

    const { errors, book: payload } = validateBookForm(values);
    setFieldErrors(errors);
    setError(null);
    const firstBad = FIELD_ORDER.find((name) => errors[name]);
    if (firstBad) {
      formRef.current.querySelector(`#book-${firstBad}`)?.focus();
      return;
    }

    // Edit: send only what changed, and nothing at all if nothing changed
    let patch = null;
    if (book) {
      patch = buildPatch(book, payload);
      if (Object.keys(patch).length === 0) {
        onSaved("unchanged");
        return;
      }
    }

    sendingRef.current = true;
    setSending(true);
    onBusyChange(true);
    try {
      if (book) await api.patch(`/api/books/${book.id}`, patch);
      else await api.post("/api/books", payload);
    } catch (err) {
      // Failed: allow another try
      sendingRef.current = false;
      setSending(false);
      onBusyChange(false);
      if (book && err.response?.status === 404) onGone();
      else setError(getApiError(err));
      return;
    }
    // Saved: the guard stays on until the form unmounts; only the parent's busy flag is cleared
    onBusyChange(false);
    onSaved(book ? "updated" : "added");
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
      <FormField
        id="book-title"
        label="Title"
        value={values.title}
        onChange={(value) => setField("title", value)}
        error={fieldErrors.title}
        maxLength={LIMITS.title + 50} // a little room, so the message can explain a too-long title
      />
      <FormField
        id="book-author"
        label="Author"
        value={values.author}
        onChange={(value) => setField("author", value)}
        error={fieldErrors.author}
        maxLength={LIMITS.author + 50}
      />
      <FormField
        id="book-genre"
        label="Genre"
        value={values.genre}
        onChange={(value) => setField("genre", value)}
        error={fieldErrors.genre}
        maxLength={LIMITS.genre + 50}
        list={genreListId}
        autoComplete="off"
      />
      <datalist id={genreListId}>
        {(genres ?? []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <FormField
        id="book-price"
        label={`Price (${CURRENCY})`}
        value={values.price}
        onChange={(value) => setField("price", value)}
        error={fieldErrors.price}
        inputMode="decimal"
        placeholder="12.50"
        autoComplete="off"
      />
      <SelectField
        id="book-status"
        label="Status"
        value={values.status}
        onChange={(value) => setField("status", value)}
        options={STATUS_OPTIONS}
      />

      {error && <ErrorBox message={error.message} details={error.details} />}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {/* Button defaults to type="button", so Cancel does not submit. It closes the native dialog. */}
        <Button
          variant="outlined"
          disabled={sending}
          onClick={(event) => event.currentTarget.closest("dialog").close()}
        >
          Cancel
        </Button>
        <Button type="submit" loading={sending}>
          {book ? "Save changes" : "Add book"}
        </Button>
      </div>
    </form>
  );
}
