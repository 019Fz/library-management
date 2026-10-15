// The books page: search, filters, sort, a grid of books and pagination (read-only for now).
// All filters live in the URL (see lib/bookQuery.js).
import { useCallback, useEffect } from "react";
import { usePageTitle } from "../lib/usePageTitle.js";
import { useBookQuery, PAGE_SIZE } from "../lib/bookQuery.js";
import { useBooks, useGenres } from "../lib/useBooks.js";
import TopBarActions from "../layouts/TopBarActions.jsx";
import SearchBox from "../components/books/SearchBox.jsx";
import FilterPanel from "../components/books/FilterPanel.jsx";
import SortSelect from "../components/books/SortSelect.jsx";
import Pagination from "../components/books/Pagination.jsx";
import BookCard, { BookCardSkeleton } from "../components/books/BookCard.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import ErrorBox from "../components/ui/ErrorBox.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

const GRID = "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4";

export default function Books() {
  usePageTitle("Books");
  const { filters, queryString, update, clearFilters } = useBookQuery();
  const { loading, error, data, retry } = useBooks(queryString);
  const { genres, failed: genresFailed } = useGenres();

  // Typing in the search box replaces the history entry, so Back does not step through every search
  const handleSearch = useCallback((text) => update({ q: text }, { replace: true }), [update]);

  // A page past the last one (for example ?page=99): move to the last page.
  // This only happens for a finished request of the current query, and only to a SMALLER page
  // number, so it cannot loop (page 1 never triggers it).
  const lastPage = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const outOfRange = Boolean(data) && data.total > 0 && data.books.length === 0 && lastPage < filters.page;
  useEffect(() => {
    if (outOfRange) update({ page: lastPage }, { replace: true });
  }, [outOfRange, lastPage, update]);

  const hasFilters = Boolean(filters.q.trim() || filters.genre || filters.status);
  const showSkeleton = loading || outOfRange;

  function handleSortChange(value) {
    const [sort, order] = value.split(":");
    update({ sort, order });
  }

  function handlePageChange(page) {
    update({ page });
    window.scrollTo({ top: 0 });
  }

  let results;
  if (showSkeleton) {
    results = (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Loading books...
        </p>
        <div className={GRID}>
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <BookCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  } else if (error) {
    results = (
      <div className="space-y-3">
        <ErrorBox message={error.message} details={error.details} />
        <Button variant="outlined" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  } else if (data.books.length === 0) {
    results = (
      <Card>
        {hasFilters ? (
          <EmptyState
            icon="search"
            title="No books match your filters"
            text="Try a different search or remove some filters."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState icon="book" title="Your library is empty" text="Books you add will show up here." />
        )}
      </Card>
    );
  } else {
    results = (
      <>
        <ul className={GRID}>
          {data.books.map((book) => (
            <li key={book.id}>
              <BookCard book={book} />
            </li>
          ))}
        </ul>
        <Pagination
          page={data.page}
          total={data.total}
          pageSize={PAGE_SIZE}
          shown={data.books.length}
          onPageChange={handlePageChange}
        />
      </>
    );
  }

  return (
    <>
      {/* Rendered here, shown in the top bar */}
      <TopBarActions>
        <SearchBox value={filters.q} onSearch={handleSearch} />
      </TopBarActions>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Books</h1>
          {/* Fixed height, so the page does not jump while the count loads */}
          <p aria-live="polite" className="h-5 text-sm text-muted">
            {data ? `${data.total} ${data.total === 1 ? "book" : "books"}` : ""}
          </p>
        </div>
        <SortSelect value={`${filters.sort}:${filters.order}`} onChange={handleSortChange} />
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[16rem_1fr] lg:items-start lg:gap-6">
        <FilterPanel
          genres={genres}
          genresFailed={genresFailed}
          genre={filters.genre}
          status={filters.status}
          onGenreChange={(genre) => update({ genre })}
          onStatusChange={(status) => update({ status })}
          onClear={clearFilters}
        />
        <section aria-label="Book results" className="mt-4 min-w-0 lg:mt-0">
          {results}
        </section>
      </div>
    </>
  );
}
