// Data hooks for the books page.
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import api, { getApiError } from "../api/client.js";

// Loads one page of books for a query string. One request per change; the previous request is
// cancelled, so a slow old answer can never replace a newer one.
//   retry()   = try again after an error (shows the skeleton again)
//   refetch() = reload the same query after a change (add/edit/delete). The books already on
//               screen stay visible meanwhile, so the card that opened a dialog is not removed.
export function useBooks(queryString) {
  const [attempt, setAttempt] = useState(0); // goes up on Retry
  const [reload, setReload] = useState(0); // goes up on refetch
  const key = `${queryString}#${attempt}#${reload}`;
  // The last finished request, the key it was for, and the query string it belonged to
  const [result, setResult] = useState({ key: null, queryString: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/books", { params: new URLSearchParams(queryString), signal: controller.signal })
      .then((res) => setResult({ key, queryString, data: res.data, error: null }))
      .catch((err) => {
        if (axios.isCancel(err)) return; // we cancelled it ourselves
        setResult({ key, queryString, data: null, error: getApiError(err) });
      });

    return () => controller.abort();
  }, [key, queryString]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const refetch = useCallback(() => setReload((n) => n + 1), []);

  // Results of an older query are ignored: until the current one finishes we are "loading".
  // Exception: a reload of the same query keeps showing the books we already have.
  const finished = result.key === key;
  const keepOld = !finished && result.data !== null && result.queryString === queryString;
  const shown = finished || keepOld;
  return {
    loading: !shown,
    error: finished ? result.error : null,
    data: shown ? result.data : null,
    retry,
    refetch,
  };
}

// Loads the caller's genres (for the filter list and the form suggestions)
export function useGenres() {
  const [state, setState] = useState({ genres: null, failed: false });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/books/genres", { signal: controller.signal })
      .then((res) => setState({ genres: res.data.genres, failed: false }))
      .catch((err) => {
        // A failed reload keeps the list we already have
        if (!axios.isCancel(err)) setState((old) => ({ genres: old.genres, failed: old.genres === null }));
      });

    return () => controller.abort();
  }, [reload]);

  const refetch = useCallback(() => setReload((n) => n + 1), []);

  return { ...state, refetch };
}
