// The books page keeps its filters in the URL query string (?q=&genre=&status=&sort=&order=&page=),
// so refresh and the back button keep them. This file reads and updates that query string.
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { STATUS_LABELS } from "./format.js";

export const PAGE_SIZE = 12;
const MAX_PAGE = 1000000; // the API rejects bigger page numbers

const SORTS = ["createdAt", "title", "price"];
const ORDERS = ["asc", "desc"];
// Values equal to these are left out of the URL
const DEFAULTS = { sort: "createdAt", order: "desc", page: 1 };

// Options of the sort dropdown; "value" is "<sort>:<order>"
export const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "title:asc", label: "Title A-Z" },
  { value: "title:desc", label: "Title Z-A" },
  { value: "price:asc", label: "Price low to high" },
  { value: "price:desc", label: "Price high to low" },
];

// Turn the URL into clean values. Anything invalid falls back to the default,
// so a hand-edited URL can never make the API answer 400.
function readFilters(params) {
  const status = params.get("status");
  const sort = params.get("sort");
  const order = params.get("order");
  const page = Number(params.get("page"));

  return {
    q: params.get("q") ?? "",
    genre: params.get("genre") ?? "",
    status: Object.hasOwn(STATUS_LABELS, status) ? status : "",
    sort: SORTS.includes(sort) ? sort : DEFAULTS.sort,
    order: ORDERS.includes(order) ? order : DEFAULTS.order,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

// The query string sent to GET /api/books
function toApiQuery(filters) {
  const query = new URLSearchParams();
  const q = filters.q.trim();
  if (q) query.set("q", q);
  if (filters.genre) query.set("genre", filters.genre);
  if (filters.status) query.set("status", filters.status);
  query.set("sort", filters.sort);
  query.set("order", filters.order);
  query.set("page", String(filters.page));
  query.set("limit", String(PAGE_SIZE));
  return query.toString();
}

export function useBookQuery() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const queryString = useMemo(() => toApiQuery(filters), [filters]);

  // patch looks like { genre: "Fantasy" }. An empty or default value removes the key.
  // Any change except a page change goes back to page 1.
  // Built from the current searchParams on every render, because setSearchParams does not queue updates.
  const update = useCallback(
    (patch, { replace = false } = {}) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === "" || value == null || value === DEFAULTS[key]) next.delete(key);
        else next.set(key, String(value));
      }
      if (!Object.keys(patch).every((key) => key === "page")) next.delete("page");
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  const clearFilters = useCallback(() => update({ q: "", genre: "", status: "" }), [update]);

  return { filters, queryString, update, clearFilters };
}
