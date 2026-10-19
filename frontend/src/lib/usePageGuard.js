// A page past the last one (for example ?page=99, or the last item of a page was deleted):
// move to the last page. This only happens for a finished request of the current query, and only
// to a SMALLER page number, so it cannot loop (page 1 never triggers it).
// total / shown = counts from the response (null while loading). Returns true while redirecting.
import { useEffect } from "react";

export function usePageGuard({ total, shown, page, pageSize, update }) {
  const loaded = total !== null;
  const lastPage = loaded ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const outOfRange = loaded && total > 0 && shown === 0 && lastPage < page;

  useEffect(() => {
    if (outOfRange) update({ page: lastPage }, { replace: true });
  }, [outOfRange, lastPage, update]);

  return outOfRange;
}
