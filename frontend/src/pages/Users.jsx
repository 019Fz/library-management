// Admin users page: search, role filter, sort, pagination (all kept in the URL), change role and delete.
import { useCallback } from "react";
import api from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import { useUserQuery, USER_PAGE_SIZE, ROLE_OPTIONS, USER_SORT_OPTIONS } from "../lib/userQuery.js";
import { useList } from "../lib/useBooks.js";
import { usePageGuard } from "../lib/usePageGuard.js";
import { useDialogState } from "../lib/useDialogState.js";
import TopBarActions from "../layouts/TopBarActions.jsx";
import SearchBox from "../components/books/SearchBox.jsx";
import SortSelect from "../components/books/SortSelect.jsx";
import Pagination from "../components/books/Pagination.jsx";
import UsersTable, { UsersSkeleton } from "../components/admin/UsersTable.jsx";
import DataError from "../components/admin/DataError.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import SelectField from "../components/ui/SelectField.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useToast } from "../components/ui/toast-context.js";

const booksText = (count) => `${count} ${count === 1 ? "book" : "books"}`;

export default function Users() {
  usePageTitle("Users");
  const { user: me } = useAuth();
  const { filters, queryString, update, clearFilters } = useUserQuery();
  const { loading, error, data, retry, refetch } = useList("/api/admin/users", queryString);
  const toast = useToast();

  // Which dialog is open: null, { type: "role", user } or { type: "delete", user }
  const { dialog, open, close, closeToHeading, getReturnFocus, headingRef } = useDialogState();
  const roleTarget = dialog?.type === "role" ? dialog.user : null;
  const deleteTarget = dialog?.type === "delete" ? dialog.user : null;
  const makeAdmin = roleTarget ? roleTarget.role !== "admin" : true;

  // Typing in the search box replaces the history entry, so Back does not step through every search
  const handleSearch = useCallback((text) => update({ q: text }, { replace: true }), [update]);

  // A page past the last one (for example after deleting the last user of a page) moves to the last page
  const outOfRange = usePageGuard({
    total: data ? data.total : null,
    shown: data ? data.users.length : 0,
    page: filters.page,
    pageSize: USER_PAGE_SIZE,
    update,
  });

  function handleRoleChanged(user) {
    // With a role filter the row may leave the list, so focus goes to the heading
    if (filters.role) closeToHeading();
    else close();
    refetch();
    toast.success(user.role === "admin" ? `${user.name} is now a regular user` : `${user.name} is now an admin`);
  }

  function handleDeleted(user) {
    closeToHeading(); // the row will disappear after the reload
    refetch();
    toast.success(`${user.name} was deleted`);
  }

  // 404: the user was removed elsewhere
  function handleGone() {
    closeToHeading();
    refetch();
    toast.error("That user no longer exists. The list was refreshed.");
  }

  function handleSortChange(value) {
    const [sort, order] = value.split(":");
    update({ sort, order });
  }

  function handlePageChange(page) {
    update({ page });
    window.scrollTo({ top: 0 });
  }

  const hasFilters = Boolean(filters.q.trim() || filters.role);

  let results;
  if (loading || outOfRange) {
    results = <UsersSkeleton rows={USER_PAGE_SIZE} />;
  } else if (error) {
    results = <DataError error={error} onRetry={retry} />;
  } else if (data.users.length === 0) {
    results = (
      <Card>
        <EmptyState
          icon="search"
          title={hasFilters ? "No users match your filters" : "No users yet"}
          text={hasFilters ? "Try a different search or remove some filters." : "Registered users show up here."}
          action={hasFilters ? <Button onClick={clearFilters}>Clear filters</Button> : null}
        />
      </Card>
    );
  } else {
    results = (
      <>
        <UsersTable
          users={data.users}
          currentUserId={me.id}
          onRole={(user, button) => open({ type: "role", user }, button)}
          onDelete={(user, button) => open({ type: "delete", user }, button)}
        />
        <Pagination
          page={data.page}
          total={data.total}
          pageSize={USER_PAGE_SIZE}
          shown={data.users.length}
          onPageChange={handlePageChange}
        />
      </>
    );
  }

  return (
    <>
      {/* Rendered here, shown in the top bar */}
      <TopBarActions>
        <SearchBox
          value={filters.q}
          onSearch={handleSearch}
          label="Search users by name or email"
          placeholder="Search name or email"
        />
      </TopBarActions>

      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink focus-ring">
          Users
        </h1>
        {/* Fixed height, so the page does not jump while the count loads */}
        <p aria-live="polite" className="h-5 text-sm text-muted">
          {data ? `${data.total} ${data.total === 1 ? "user" : "users"}` : ""}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-48">
          <SelectField
            id="user-role-filter"
            label="Role"
            value={filters.role}
            onChange={(role) => update({ role })}
            options={ROLE_OPTIONS}
          />
        </div>
        <SortSelect options={USER_SORT_OPTIONS} value={`${filters.sort}:${filters.order}`} onChange={handleSortChange} />
      </div>

      <section aria-label="User results" className="mt-4">
        {results}
      </section>

      <ConfirmDialog
        target={roleTarget}
        title={makeAdmin ? `Make ${roleTarget?.name} an admin?` : `Remove admin rights from ${roleTarget?.name}?`}
        text={
          makeAdmin
            ? "They will be able to see and manage every user and every book."
            : "They will lose access to the admin pages. Their own books stay."
        }
        confirmLabel={makeAdmin ? "Make admin" : "Remove admin"}
        variant="primary"
        request={(user) => api.patch(`/api/admin/users/${user.id}`, { role: user.role === "admin" ? "user" : "admin" })}
        onDone={handleRoleChanged}
        onGone={handleGone}
        onClose={close}
        getReturnFocus={getReturnFocus}
      />
      <ConfirmDialog
        target={deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        text={
          deleteTarget?.booksCount > 0
            ? `Their ${booksText(deleteTarget.booksCount)} will be deleted too. This cannot be undone.`
            : "This cannot be undone."
        }
        request={(user) => api.delete(`/api/admin/users/${user.id}`)}
        onDone={handleDeleted}
        onGone={handleGone}
        onClose={close}
        getReturnFocus={getReturnFocus}
      />
    </>
  );
}
