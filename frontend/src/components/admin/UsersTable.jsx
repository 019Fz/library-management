// The users list. The same rows are drawn twice: a real table from "md" up, stacked cards on phones.
//   users, currentUserId = the rows and the signed-in admin
//   onRole(user, button) / onDelete(user, button) = open the confirmation dialogs
// The signed-in admin's own row cannot be changed: its buttons use aria-disabled (still focusable, the
// click is ignored) and point at a visible "This is you" note with aria-describedby.
import { useId } from "react";
import { Link } from "react-router-dom";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatDate } from "../../lib/format.js";

function RoleBadge({ role }) {
  return (
    <Badge tone={role === "admin" ? "accent" : "neutral"} className="capitalize">
      {role}
    </Badge>
  );
}

// Number of books; a link to that user's books when there are any
function BooksLink({ user }) {
  if (user.booksCount === 0) return <span>0</span>;
  return (
    <Link
      to={`/admin/books?userId=${user.id}`}
      state={{ ownerName: user.name }}
      aria-label={`${user.booksCount} ${user.booksCount === 1 ? "book" : "books"}, show books of ${user.name}`}
      className="inline-flex min-h-11 min-w-11 items-center font-medium text-ink underline focus-ring"
    >
      {user.booksCount}
    </Link>
  );
}

function UserActions({ user, isSelf, onRole, onDelete }) {
  const noteId = useId();
  const makeAdmin = user.role !== "admin";
  const describedBy = isSelf ? noteId : undefined;
  // On your own row the click is ignored
  const run = (handler) => (event) => {
    if (!isSelf) handler(user, event.currentTarget);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outlined"
        aria-disabled={isSelf || undefined}
        aria-describedby={describedBy}
        aria-label={`${makeAdmin ? "Make admin" : "Remove admin"} ${user.name}`}
        onClick={run(onRole)}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {makeAdmin ? "Make admin" : "Remove admin"}
      </Button>
      <button
        type="button"
        aria-disabled={isSelf || undefined}
        aria-describedby={describedBy}
        aria-label={`Delete ${user.name}`}
        onClick={run(onDelete)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger focus-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        <Icon name="trash" />
      </button>
      {isSelf && (
        <span id={noteId} className="text-sm font-medium text-muted">
          This is you
        </span>
      )}
    </div>
  );
}

const COLUMNS = ["Name", "Email", "Role", "Books", "Joined", "Actions"];

export default function UsersTable({ users, currentUserId, onRole, onDelete }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-card shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Users, with their role, number of books and join date</caption>
          <thead className="border-b border-line text-muted">
            <tr>
              {COLUMNS.map((name) => (
                <th key={name} scope="col" className="px-4 py-3 font-medium">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => (
              <tr key={user.id}>
                <th scope="row" className="px-4 py-2 font-semibold text-ink">
                  <span className="block max-w-48 truncate">{user.name}</span>
                </th>
                <td className="px-4 py-2 text-muted">
                  <span className="block max-w-56 truncate">{user.email}</span>
                </td>
                <td className="px-4 py-2">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-2 text-ink">
                  <BooksLink user={user} />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-2">
                  <UserActions user={user} isSelf={user.id === currentUserId} onRole={onRole} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {users.map((user) => (
          <li key={user.id} className="rounded-card border border-line bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{user.name}</p>
                <p className="truncate text-sm text-muted">{user.email}</p>
              </div>
              <RoleBadge role={user.role} />
            </div>
            <dl className="mt-2 flex flex-wrap items-center gap-x-6 text-sm text-muted">
              <div className="flex items-center gap-1">
                <dt>Books</dt>
                <dd className="text-ink">
                  <BooksLink user={user} />
                </dd>
              </div>
              <div className="flex items-center gap-1">
                <dt>Joined</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
            <div className="mt-2">
              <UserActions user={user} isSelf={user.id === currentUserId} onRole={onRole} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// Gray placeholders with the same two layouts, shown while users load
export function UsersSkeleton({ rows }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading users...
      </p>
      <div aria-hidden="true" className="hidden divide-y divide-line rounded-card border border-line bg-card shadow-sm md:block">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-6 px-4 py-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="ml-auto h-11 w-40" />
          </div>
        ))}
      </div>
      <ul aria-hidden="true" className="space-y-3 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="rounded-card border border-line bg-card p-4 shadow-sm">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-3 h-11 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
