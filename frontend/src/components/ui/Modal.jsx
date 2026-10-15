// A modal built on the native <dialog> element.
//   open           = show or hide it (the parent owns this state)
//   onClose        = called after the dialog closed (Escape, backdrop, X button or open=false).
//                    It can fire more than once, so it must only reset state.
//   title          = shown in the header and used as the accessible name
//   busy           = a request is running: Escape, backdrop click and the X button do nothing
//   initialFocus   = optional CSS selector of the element that gets focus first
//   getReturnFocus = optional function returning the element to focus after closing
//                    (default: the element that was focused when the dialog opened)
// Children are only rendered while open, so a form inside starts fresh every time.
import { useId, useRef, useEffect } from "react";
import Icon from "./Icon.jsx";

export default function Modal({ open, onClose, title, busy = false, initialFocus, getReturnFocus, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const opener = useRef(null); // the button that opened the dialog
  const pressStartedOnBackdrop = useRef(false);

  // Open or close the native dialog when `open` changes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal(); // focus moves to the first focusable element
      if (initialFocus) dialog.querySelector(initialFocus)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  // Fires after every close, however it happened: give focus back, then tell the parent
  function handleClose() {
    const target = getReturnFocus?.() ?? opener.current;
    if (target?.isConnected) target.focus();
    onClose();
  }

  // Escape: stay open while a request is running
  function handleCancel(event) {
    if (busy) event.preventDefault();
  }

  // Backdrop click: the press AND the release must both be on the backdrop, so selecting
  // text inside the dialog and releasing outside does not close it
  function handleMouseDown(event) {
    pressStartedOnBackdrop.current = event.target === dialogRef.current;
  }
  function handleClick(event) {
    const startedOnBackdrop = pressStartedOnBackdrop.current;
    pressStartedOnBackdrop.current = false;
    if (!busy && startedOnBackdrop && event.target === dialogRef.current) dialogRef.current.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-card p-0 text-ink backdrop:bg-ink/50"
    >
      {/* The panel fills the dialog, so a click on the dialog itself can only be a backdrop click */}
      {open && (
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="min-w-0 break-words text-lg font-bold text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current.close()}
              disabled={busy}
              aria-label="Close dialog"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
