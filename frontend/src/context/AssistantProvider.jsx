// Holds the assistant's state for the whole logged-in area: open/expanded, the conversation and the requests.
// Everything lives in memory only. Nothing is saved to the server, localStorage or the URL, and
// question text is never logged. It is mounted in AppLayout, so it disappears on logout.
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { getApiError } from "../api/client.js";
import { capMessages, MAX_QUESTION_LENGTH, retrySecondsFrom } from "../lib/assistant.js";
import { AssistantContext } from "./assistant-context.js";

const QUERY_TIMEOUT_MS = 20000;

export function AssistantProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [examples, setExamples] = useState([]);
  const [busy, setBusy] = useState(false);
  // When the server's rate limit ends (a timestamp), or 0
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const busyRef = useRef(false); // double-submit guard (state would be one render late)
  const cooldownRef = useRef(0);
  const controllerRef = useRef(null); // the request that is running now
  const examplesControllerRef = useRef(null);
  const examplesRequested = useRef(false);
  const nextId = useRef(1);

  const addMessage = useCallback((message) => {
    setMessages((list) => capMessages([...list, { id: nextId.current++, ...message }]));
  }, []);

  // Ask a question. With reuse: true the question already has a bubble (a retry), so none is added.
  const send = useCallback(
    async (raw, { reuse = false } = {}) => {
      const question = String(raw ?? "").trim();
      if (!question || question.length > MAX_QUESTION_LENGTH) return;
      if (busyRef.current || Date.now() < cooldownRef.current) return;

      busyRef.current = true;
      setBusy(true);
      const controller = new AbortController();
      controllerRef.current = controller;
      if (!reuse) addMessage({ role: "user", text: question });

      try {
        const { data } = await api.post(
          "/api/ai/query",
          { question },
          { signal: controller.signal, timeout: QUERY_TIMEOUT_MS },
        );
        if (controller.signal.aborted) return; // cleared or logged out while waiting
        addMessage({ role: "assistant", reply: data });
      } catch (error) {
        if (controller.signal.aborted || axios.isCancel(error)) return;

        const status = error.response?.status;
        let failure;
        if (status === 429) {
          const seconds = retrySecondsFrom(error.response.headers?.["retry-after"], error.response.data?.error);
          cooldownRef.current = Date.now() + seconds * 1000;
          setCooldownUntil(cooldownRef.current);
          failure = { message: `Too many questions. Try again in ${seconds} seconds.`, retryable: false };
        } else if (!error.response && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")) {
          failure = { message: "That took too long. Try again.", retryable: true };
        } else {
          // A 400 would fail the same way again, so it gets no Retry button
          failure = { message: getApiError(error).message, retryable: status !== 400 };
        }
        addMessage({ role: "assistant", error: { ...failure, question } });
      } finally {
        // Only the request that is still current may reset the state (Clear already did it for the others)
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [addMessage],
  );

  // Retry a failed question: drop the error card and ask again under the same bubble
  const retry = useCallback(
    (messageId, question) => {
      setMessages((list) => list.filter((m) => m.id !== messageId));
      send(question, { reuse: true });
    },
    [send],
  );

  // Forget the conversation and cancel any request that is running
  const clear = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setMessages([]);
  }, []);

  // The panel cannot be closed while a question is running
  const close = useCallback(() => {
    if (!busyRef.current) setOpen(false);
  }, []);
  const toggleOpen = useCallback(() => {
    if (busyRef.current) return;
    setOpen((value) => !value);
  }, []);

  // Rate limit over: allow sending again
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setTimeout(
      () => {
        cooldownRef.current = 0;
        setCooldownUntil(0);
      },
      Math.max(0, cooldownUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [cooldownUntil]);

  // The example chips are loaded once, the first time the panel opens. A failure just hides them.
  useEffect(() => {
    if (!open || examplesRequested.current) return;
    examplesRequested.current = true;
    const controller = new AbortController();
    examplesControllerRef.current = controller;
    api
      .get("/api/ai/examples", { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted && Array.isArray(res.data?.examples)) setExamples(res.data.examples);
      })
      .catch(() => {});
  }, [open]);

  // Leaving the logged-in area (logout) cancels whatever is still running
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      examplesControllerRef.current?.abort();
    };
  }, []);

  const value = useMemo(
    () => ({
      open,
      expanded,
      messages,
      examples,
      busy,
      cooldownUntil,
      send,
      retry,
      clear,
      close,
      toggleOpen,
      setExpanded,
    }),
    [open, expanded, messages, examples, busy, cooldownUntil, send, retry, clear, close, toggleOpen],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
