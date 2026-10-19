// Data hooks shared by the books, users and dashboard pages.
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import api, { getApiError } from "../api/client.js";

// Loads a list (or any GET) for a url plus a query string. One request per change; the previous
// request is cancelled, so a slow old answer can never replace a newer one.
//   retry()   = try again after an error (shows the skeleton again)
//   refetch() = reload the same query after a change (add/edit/delete). The data already on
//               screen stays visible meanwhile, so the element that opened a dialog is not removed.
// error is { message, details, status }; status (for example 403) comes from the response.
export function useList(url, queryString) {
  const [attempt, setAttempt] = useState(0); // goes up on Retry
  const [reload, setReload] = useState(0); // goes up on refetch
  const key = `${url}?${queryString}#${attempt}#${reload}`;
  // The last finished request, the key it was for, and the url + query string it belonged to
  const [result, setResult] = useState({ key: null, source: null, data: null, error: null });
  const source = `${url}?${queryString}`;

  useEffect(() => {
    const controller = new AbortController();

    api
      .get(url, { params: new URLSearchParams(queryString), signal: controller.signal })
      .then((res) => setResult({ key, source, data: res.data, error: null }))
      .catch((err) => {
        if (axios.isCancel(err)) return; // we cancelled it ourselves
        setResult({ key, source, data: null, error: { ...getApiError(err), status: err.response?.status } });
      });

    return () => controller.abort();
  }, [key, url, queryString, source]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const refetch = useCallback(() => setReload((n) => n + 1), []);

  // Results of an older query are ignored: until the current one finishes we are "loading".
  // Exception: a reload of the same query keeps showing the data we already have.
  const finished = result.key === key;
  const keepOld = !finished && result.data !== null && result.source === source;
  const shown = finished || keepOld;
  return {
    loading: !shown,
    error: finished ? result.error : null,
    data: shown ? result.data : null,
    retry,
    refetch,
  };
}

// One page of the caller's books
export function useBooks(queryString) {
  return useList("/api/books", queryString);
}

// Loads genres (for the filter list and the form suggestions). The url decides whose genres.
export function useGenres(url = "/api/books/genres") {
  const [state, setState] = useState({ genres: null, failed: false });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get(url, { signal: controller.signal })
      .then((res) => setState({ genres: res.data.genres, failed: false }))
      .catch((err) => {
        // A failed reload keeps the list we already have
        if (!axios.isCancel(err)) setState((old) => ({ genres: old.genres, failed: old.genres === null }));
      });

    return () => controller.abort();
  }, [url, reload]);

  const refetch = useCallback(() => setReload((n) => n + 1), []);

  return { ...state, refetch };
}
