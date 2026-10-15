// The toast context and hook live in their own file (like auth-context.js), so Toast.jsx only exports components.
import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
