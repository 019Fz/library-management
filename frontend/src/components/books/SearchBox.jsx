// Search box for the top bar. It sends the text 300 ms after you stop typing.
//   value    = the search text currently in the URL
//   onSearch = called with the new text
import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.jsx";

const DEBOUNCE_MS = 300;

export default function SearchBox({ value, onSearch }) {
  const [text, setText] = useState(value);
  // The last text this box sent itself. It lets us tell our own URL update from an outside change.
  const lastSent = useRef(value);

  // The URL changed from outside (back button, "Clear filters"): show it in the box.
  // Our own update is ignored here, so text typed in the meantime is never overwritten.
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setText(value);
    }
  }, [value]);

  // Send the text once typing pauses. onSearch changes whenever the URL changes, which
  // restarts this timer, so it always sends with the latest filters.
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => {
      lastSent.current = text;
      onSearch(text);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);

  // Enter searches right away
  function handleSubmit(event) {
    event.preventDefault();
    lastSent.current = text;
    onSearch(text);
  }

  function handleClear() {
    setText("");
    lastSent.current = "";
    onSearch("");
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="relative w-full">
      <label htmlFor="book-search" className="sr-only">
        Search books by title or author
      </label>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" />
      </span>
      <input
        id="book-search"
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search title or author"
        autoComplete="off"
        enterKeyHint="search"
        className="block min-h-11 w-full rounded-full border border-edge bg-card pl-10 pr-11 text-base text-ink placeholder:text-muted focus-ring [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink focus-ring"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
