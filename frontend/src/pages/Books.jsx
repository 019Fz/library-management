// The books page: search, filters, sort, a grid of books and pagination, plus add, edit and delete.
// All filters live in the URL (see lib/bookQuery.js).
import { useCallback } from "react";
import api from "../api/client.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import { useBookQuery, PAGE_SIZE } from "../lib/bookQuery.js";
import { useBooks, useGenres } from "../lib/useBooks.js";
import { usePageGuard } from "../lib/usePageGuard.js";
import { useDialogState } from "../lib/useDialogState.js";
import TopBarActions from "../layouts/TopBarActions.jsx";
import SearchBox from "../components/books/SearchBox.jsx";
import FilterPanel from "../components/books/FilterPanel.jsx";
import SortSelect from "../components/books/SortSelect.jsx";
import Pagination from "../components/books/Pagination.jsx";
import BookCard, { BookCardSkeleton, BOOK_GRID as GRID } from "../components/books/BookCard.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import ErrorBox from "../components/ui/ErrorBox.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Icon from "../components/ui/Icon.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useToast } from "../components/ui/toast-context.js";
import BookFormDialog from "../components/books/BookFormDialog.jsx";

export default function Books() {
  usePageTitle("Books");
  const { filters, queryString, update, clearFilters } = useBookQuery();
  const { loading, error, data, retry, refetch } = useBooks(queryString);
  const { genres, failed: genresFailed, refetch: refetchGenres } = useGenres();
  const toast = useToast();

  // Which dialog is open: null, { type: "add" }, { type: "edit", book } or { type: "delete", book }
  const { dialog, open: openDialog, close: closeDialog, closeToHeading, getReturnFocus, headingRef } = useDialogState();

  // Reload the current page (filters stay in the URL) and the genre list
  function reload() {
    refetch();
    refetchGenres();
  }

  function handleSaved(kind) {
    closeDialog();
    if (kind === "unchanged") return; // nothing was sent
    reload();
    toast.success(kind === "added" ? "Book added" : "Book updated");
  }

  function handleDeleted() {
    closeToHeading(); // the card will disappear after the reload
    reload();
    toast.success("Book deleted");
  }

  // 404: the book was removed elsewhere
  function handleGone() {
    closeToHeading();
    reload();
    toast.error("That book no longer exists. The list was refreshed.");
  }

  // Typing in the search box replaces the history entry, so Back does not step through every search
  const handleSearch = useCallback((text) => update({ q: text }, { replace: true }), [update]);

  // A page past the last one (for example ?page=99) moves to the last page
  const outOfRange = usePageGuard({
    total: data ? data.total : null,
    shown: data ? data.books.length : 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    update,
  });
  const deleting = dialog?.type === "delete" ? dialog.book : null;

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
        target={deleting}
        title={deleting ? `Delete ${deleting.title}?` : ""}
        text="This cannot be undone."
        request={(book) => api.delete(`/api/books/${book.id}`)}
        onDone={handleDeleted}
        onGone={handleGone}
        onClose={closeDialog}
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
