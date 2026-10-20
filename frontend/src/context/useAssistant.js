// Small hook so components can write: const { messages, send } = useAssistant()
import { useContext } from "react";
import { AssistantContext } from "./assistant-context.js";

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("useAssistant must be used inside <AssistantProvider>");
  return context;
}
