// Admin "All books" page: every user's books with their owner. Search, genre, status, owner, sort and
// pagination live in the URL. Admins can edit and delete books here (not add: books belong to users).
import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import { useAdminBookQuery, PAGE_SIZE } from "../lib/bookQuery.js";
import { useList, useGenres } from "../lib/useBooks.js";
import { usePageGuard } from "../lib/usePageGuard.js";
import { useDialogState } from "../lib/useDialogState.js";
import TopBarActions from "../layouts/TopBarActions.jsx";
import SearchBox from "../components/books/SearchBox.jsx";
import FilterPanel from "../components/books/FilterPanel.jsx";
import SortSelect from "../components/books/SortSelect.jsx";
import Pagination from "../components/books/Pagination.jsx";
import BookCard, { BookCardSkeleton, BOOK_GRID } from "../components/books/BookCard.jsx";
import BookFormDialog from "../components/books/BookFormDialog.jsx";
import DataError from "../components/admin/DataError.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Icon from "../components/ui/Icon.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useToast } from "../components/ui/toast-context.js";

export default function AdminBooks() {
  usePageTitle("All books");
  const { filters, queryString, update, clearFilters } = useAdminBookQuery();
  const { loading, error, data, retry, refetch } = useList("/api/admin/books", queryString);
  const { genres, failed: genresFailed, refetch: refetchGenres } = useGenres("/api/admin/genres");
  const toast = useToast();
  const location = useLocation();

  // Which dialog is open: null, { type: "edit", book } or { type: "delete", book }
  const { dialog, open, close, closeToHeading, getReturnFocus, headingRef } = useDialogState();
  const deleting = dialog?.type === "delete" ? dialog.book : null;

  // Reload the current page (filters stay in the URL) and the genre list
  function reload() {
    refetch();
    refetchGenres();
  }

  function handleSaved(kind) {
    close();
    if (kind === "unchanged") return; // nothing was sent
    reload();
    toast.success("Book updated");
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

  // A page past the last one moves to the last page
  const outOfRange = usePageGuard({
    total: data ? data.total : null,
    shown: data ? data.books.length : 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    update,
  });

  // Name for the owner chip: from the loaded books, else from the link that brought us here, else the id
  const ownerFromBooks = data?.books.find((book) => String(book.owner.id) === filters.userId)?.owner.name;
  const ownerName = ownerFromBooks ?? location.state?.ownerName ?? `User #${filters.userId}`;

  const hasFilters = Boolean(filters.q.trim() || filters.genre || filters.status || filters.userId);

  function handleSortChange(value) {
    const [sort, order] = value.split(":");
    update({ sort, order });
  }

  function handlePageChange(page) {
    update({ page });
    window.scrollTo({ top: 0 });
  }

  let results;
  if (loading || outOfRange) {
    results = (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Loading books...
        </p>
        <div className={BOOK_GRID}>
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <BookCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  } else if (error) {
    results = <DataError error={error} onRetry={retry} />;
  } else if (data.books.length === 0) {
    results = (
      <Card>
        <EmptyState
          icon={hasFilters ? "search" : "book"}
          title={hasFilters ? "No books match your filters" : "No books yet"}
          text={hasFilters ? "Try a different search or remove some filters." : "Books added by users show up here."}
          action={hasFilters ? <Button onClick={clearFilters}>Clear filters</Button> : null}
        />
      </Card>
    );
  } else {
    results = (
      <>
        <ul className={BOOK_GRID}>
          {data.books.map((book) => (
            <li key={book.id}>
              <BookCard
                book={book}
                owner={book.owner}
                onEdit={(target, button) => open({ type: "edit", book: target }, button)}
                onDelete={(target, button) => open({ type: "delete", book: target }, button)}
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
        <SearchBox value={filters.q} onSearch={handleSearch} label="Search all books by title or author" />
      </TopBarActions>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink focus-ring">
            All books
          </h1>
          {/* Fixed height, so the page does not jump while the count loads */}
          <p aria-live="polite" className="h-5 text-sm text-muted">
            {data ? `${data.total} ${data.total === 1 ? "book" : "books"}` : ""}
          </p>
        </div>
        <SortSelect value={`${filters.sort}:${filters.order}`} onChange={handleSortChange} />
      </div>

      {filters.userId && (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-accent-soft pl-4 text-sm font-medium text-ink">
            <span className="min-w-0 truncate">Owner: {ownerName}</span>
            <button
              type="button"
              onClick={() => update({ userId: "" })}
              aria-label="Remove owner filter"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-card/60 focus-ring"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}

      <BookFormDialog
        open={dialog?.type === "edit"}
        book={dialog?.type === "edit" ? dialog.book : null}
        genres={genres}
        endpoint="/api/admin/books"
        onClose={close}
        onSaved={handleSaved}
        onGone={handleGone}
        getReturnFocus={getReturnFocus}
      />
      <ConfirmDialog
        target={deleting}
        title={`Delete ${deleting?.title}?`}
        text={`This book belongs to ${deleting?.owner.name}. This cannot be undone.`}
        request={(book) => api.delete(`/api/admin/books/${book.id}`)}
        onDone={handleDeleted}
        onGone={handleGone}
        onClose={close}
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
