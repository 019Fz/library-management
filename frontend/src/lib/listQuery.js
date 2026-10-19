// Lists (books, users, all books) keep their filters in the URL query string, so refresh and the
// back button keep them. createListQuery builds the hook that reads and updates that query string.
//   pageSize = items per page
//   filters  = { name: null | isValid(value) }: null accepts any text, a function accepts only valid values
//   sorts    = the allowed values of ?sort
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const MAX_PAGE = 1000000; // the API rejects bigger page numbers
const ORDERS = ["asc", "desc"];

// Validators for filters
export const oneOf = (values) => (value) => values.includes(value);
export const positiveInt = (value) => /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;

export function createListQuery({ pageSize, filters, sorts, defaultSort = "createdAt", defaultOrder = "desc" }) {
  // Values equal to these are left out of the URL
  const DEFAULTS = { sort: defaultSort, order: defaultOrder, page: 1 };

  // Turn the URL into clean values. Anything invalid falls back to the default,
  // so a hand-edited URL can never make the API answer 400.
  function readFilters(params) {
    const result = {};
    for (const [name, isValid] of Object.entries(filters)) {
      const value = params.get(name) ?? "";
      result[name] = !isValid || isValid(value) ? value : "";
    }
    const sort = params.get("sort");
    const order = params.get("order");
    const page = Number(params.get("page"));
    result.sort = sorts.includes(sort) ? sort : DEFAULTS.sort;
    result.order = ORDERS.includes(order) ? order : DEFAULTS.order;
    result.page = Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
    return result;
  }

  // The query string sent to the API
  function toApiQuery(values) {
    const query = new URLSearchParams();
    for (const name of Object.keys(filters)) {
      const value = name === "q" ? values.q.trim() : values[name];
      if (value) query.set(name, value);
    }
    query.set("sort", values.sort);
    query.set("order", values.order);
    query.set("page", String(values.page));
    query.set("limit", String(pageSize));
    return query.toString();
  }

  function useListQuery() {
    const [searchParams, setSearchParams] = useSearchParams();

    const values = useMemo(() => readFilters(searchParams), [searchParams]);
    const queryString = useMemo(() => toApiQuery(values), [values]);

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

    // Clears every filter (search included) but keeps the sort
    const clearFilters = useCallback(
      () => update(Object.fromEntries(Object.keys(filters).map((name) => [name, ""]))),
      [update],
    );

    return { filters: values, queryString, update, clearFilters };
  }

  return { pageSize, readFilters, toApiQuery, useListQuery };
}
