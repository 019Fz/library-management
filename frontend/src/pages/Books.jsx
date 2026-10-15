// The books page: search, filters, sort, a grid of books and pagination, plus add, edit and delete.
// All filters live in the URL (see lib/bookQuery.js).
import { useCallback, useEffect, useRef, useState } from "react";
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
import Icon from "../components/ui/Icon.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useToast } from "../components/ui/toast-context.js";
import BookFormDialog from "../components/books/BookFormDialog.jsx";

const GRID = "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4";

export default function Books() {
  usePageTitle("Books");
  const { filters, queryString, update, clearFilters } = useBookQuery();
  const { loading, error, data, retry, refetch } = useBooks(queryString);
  const { genres, failed: genresFailed, refetch: refetchGenres } = useGenres();
  const toast = useToast();

  // Which dialog is open: null, { type: "add" }, { type: "edit", book } or { type: "delete", book }
  const [dialog, setDialog] = useState(null);
  const headingRef = useRef(null); // focus goes here when the card that opened a dialog is gone
  const triggerRef = useRef(null); // the button that opened the dialog
  const focusHeadingRef = useRef(false);

  function openDialog(next, trigger) {
    triggerRef.current = trigger ?? null;
    focusHeadingRef.current = false;
    setDialog(next);
  }

  // onClose can fire more than once, so it only resets the state (toasts and reloads happen in the handlers below)
  const closeDialog = useCallback(() => setDialog(null), []);

  // After closing, focus returns to the trigger button, or to the heading if the book is gone
  function getReturnFocus() {
    return focusHeadingRef.current ? headingRef.current : triggerRef.current;
  }

  // Reload the current page (filters stay in the URL) and the genre list
  function reload() {
    refetch();
    refetchGenres();
  }

  function handleSaved(kind) {
    setDialog(null);
    if (kind === "unchanged") return; // nothing was sent
    reload();
    toast.success(kind === "added" ? "Book added" : "Book updated");
  }

  function handleDeleted() {
    focusHeadingRef.current = true; // the card will disappear after the reload
    setDialog(null);
    reload();
    toast.success("Book deleted");
  }

  // 404: the book was removed elsewhere
  function handleGone() {
    focusHeadingRef.current = true;
    setDialog(null);
    reload();
    toast.error("That book no longer exists. The list was refreshed.");
  }

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
          <EmptyState
            icon="book"
            title="Your library is empty"
            text="Books you add will show up here."
            action={
              <Button onClick={(event) => openDialog({ type: "add" }, event.currentTarget)}>Add your first book</Button>
            }
          />
        )}
      </Card>
    );
  } else {
    results = (
      <>
        <ul className={GRID}>
          {data.books.map((book) => (
            <li key={book.id}>
              <BookCard
                book={book}
                onEdit={(target, button) => openDialog({ type: "edit", book: target }, button)}
                onDelete={(target, button) => openDialog({ type: "delete", book: target }, button)}
              />
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
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink focus-ring">
            Books
          </h1>
          {/* Fixed height, so the page does not jump while the count loads */}
          <p aria-live="polite" className="h-5 text-sm text-muted">
            {data ? `${data.total} ${data.total === 1 ? "book" : "books"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SortSelect value={`${filters.sort}:${filters.order}`} onChange={handleSortChange} />
          <Button onClick={(event) => openDialog({ type: "add" }, event.currentTarget)}>
            <Icon name="plus" />
            Add book
          </Button>
        </div>
      </div>

      <BookFormDialog
        open={dialog?.type === "add" || dialog?.type === "edit"}
        book={dialog?.type === "edit" ? dialog.book : null}
        genres={genres}
        onClose={closeDialog}
        onSaved={handleSaved}
        onGone={handleGone}
        getReturnFocus={getReturnFocus}
      />
      <ConfirmDialog
        book={dialog?.type === "delete" ? dialog.book : null}
        onClose={closeDialog}
        onDeleted={handleDeleted}
        onGone={handleGone}
        getReturnFocus={getReturnFocus}
      />

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
