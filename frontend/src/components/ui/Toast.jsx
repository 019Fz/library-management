// Toast messages. Wrap the app in <ToastProvider>, then call useToast() anywhere:
//   const toast = useToast();  toast.success("Book added");  toast.error("Something failed");
// A toast disappears after about 5 seconds; hovering or focusing it pauses the timer.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { ToastContext } from "./toast-context.js";

const DISMISS_MS = 5000;

function ToastItem({ toast, onDismiss }) {
  const timer = useRef(null);

  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(toast.id), DISMISS_MS);
  }, [onDismiss, toast.id]);
  const pause = useCallback(() => clearTimeout(timer.current), []);

  useEffect(() => {
    start();
    return pause;
  }, [start, pause]);

  const isError = toast.kind === "error";
  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      className={`pointer-events-auto flex items-start gap-3 rounded-card border p-3 text-sm shadow-md ${
        isError ? "border-danger bg-danger-soft text-danger" : "border-completed bg-completed-soft text-ink"
      }`}
    >
      <Icon name={isError ? "alert" : "check"} className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 break-words py-0.5 font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-card/60 focus-ring"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((item) => item.id !== id)), []);
  const add = useCallback((kind, message) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message }]);
  }, []);

  const api = useMemo(
    () => ({ success: (message) => add("success", message), error: (message) => add("error", message) }),
    [add],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Both live regions always exist, so screen readers announce what is added to them.
          Phones: full width at the bottom. From "sm": bottom right. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch gap-2 p-4 sm:left-auto sm:w-96">
        <div aria-live="polite" className="flex flex-col gap-2">
          {toasts
            .filter((item) => item.kind === "success")
            .map((item) => (
              <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
            ))}
        </div>
        <div role="alert" className="flex flex-col gap-2">
          {toasts
            .filter((item) => item.kind === "error")
            .map((item) => (
              <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
