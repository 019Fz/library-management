// "Showing 1-12 of 37" plus Previous / page numbers / Next.
import Button from "../ui/Button.jsx";

// Page numbers with gaps, e.g. 1 ... 4 5 6 ... 20. Gaps are marked with a string.
function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  const items = [1];
  if (start > 2) items.push("gap-before");
  for (let number = start; number <= end; number += 1) items.push(number);
  if (end < totalPages - 1) items.push("gap-after");
  items.push(totalPages);
  return items;
}

// shown: how many books are on this page
export default function Pagination({ page, total, pageSize, shown, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = first + shown - 1;

  return (
    <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted">
        Showing {first}-{last} of {total}
      </p>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button variant="outlined" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>

          {/* Phones: just "Page 2 of 3". From "sm" up: numbered buttons. */}
          <p className="px-2 text-sm text-muted sm:hidden">
            Page {page} of {totalPages}
          </p>
          <ol className="hidden items-center gap-1 sm:flex">
            {pageItems(page, totalPages).map((item) =>
              typeof item === "string" ? (
                <li key={item} aria-hidden="true" className="px-1 text-muted">
                  …
                </li>
              ) : (
                <li key={item}>
                  <Button
                    variant={item === page ? "secondary" : "ghost"}
                    size="sm"
                    className="min-w-9 px-0!"
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </Button>
                </li>
              ),
            )}
          </ol>

          <Button variant="outlined" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
