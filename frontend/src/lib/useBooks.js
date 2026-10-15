// Data hooks for the books page.
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import api, { getApiError } from "../api/client.js";

// Loads one page of books for a query string. One request per change; the previous request is
// cancelled, so a slow old answer can never replace a newer one.
export function useBooks(queryString) {
  const [attempt, setAttempt] = useState(0); // goes up on Retry
  const key = `${queryString}#${attempt}`;
  // The last finished request and the key it was for
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/books", { params: new URLSearchParams(queryString), signal: controller.signal })
      .then((res) => setResult({ key, data: res.data, error: null }))
      .catch((err) => {
        if (axios.isCancel(err)) return; // we cancelled it ourselves
        setResult({ key, data: null, error: getApiError(err) });
      });

    return () => controller.abort();
  }, [key, queryString]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Results of an older query are ignored: until the current one finishes we are "loading"
  const finished = result.key === key;
  return {
    loading: !finished,
    error: finished ? result.error : null,
    data: finished ? result.data : null,
    retry,
  };
}

// Loads the caller's genres once, for the filter list
export function useGenres() {
  const [state, setState] = useState({ genres: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/books/genres", { signal: controller.signal })
      .then((res) => setState({ genres: res.data.genres, failed: false }))
      .catch((err) => {
        if (!axios.isCancel(err)) setState({ genres: null, failed: true });
      });

    return () => controller.abort();
  }, []);

  return state;
}
