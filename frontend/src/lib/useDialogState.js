// State of the dialogs on a list page: which dialog is open, and where focus goes after it closes.
//   dialog          = null or whatever the page passed to open(), e.g. { type: "edit", item }
//   open(next, btn) = open a dialog; btn is the clicked button, so focus can return to it
//   close()         = only resets the state (the dialog's onClose can fire more than once)
//   closeToHeading()= close, and focus the page heading afterwards (the clicked row may be gone)
//   headingRef      = put it on the page <h1 tabIndex={-1}>
import { useCallback, useRef, useState } from "react";

export function useDialogState() {
  const [dialog, setDialog] = useState(null);
  const headingRef = useRef(null);
  const triggerRef = useRef(null); // the button that opened the dialog
  const focusHeadingRef = useRef(false);

  const open = useCallback((next, trigger) => {
    triggerRef.current = trigger ?? null;
    focusHeadingRef.current = false;
    setDialog(next);
  }, []);

  const close = useCallback(() => setDialog(null), []);

  const closeToHeading = useCallback(() => {
    focusHeadingRef.current = true;
    setDialog(null);
  }, []);

  // Used by Modal after closing: the trigger button, or the heading if the item is gone
  const getReturnFocus = useCallback(() => (focusHeadingRef.current ? headingRef.current : triggerRef.current), []);

  return { dialog, open, close, closeToHeading, getReturnFocus, headingRef };
}
