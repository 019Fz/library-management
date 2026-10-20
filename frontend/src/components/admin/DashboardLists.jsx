// The two list cards of the dashboard. Each takes null while loading and then shows
// skeleton rows with the same count as the real list (5), so nothing jumps.
import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatDate } from "../../lib/format.js";
import { relativeTime } from "../../lib/dashboard.js";

const ROWS = 5;

// link = { to, label }: the "see all" link on the right of the title
function ListCard({ title, link, loading, empty, children }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <Link to={link.to} className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-ink underline focus-ring">
          {link.label}
        </Link>
      </div>
      {loading ? (
        <ul aria-hidden="true" className="divide-y divide-line">
          {Array.from({ length: ROWS }, (_, index) => (
            <li key={index} className="py-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </li>
          ))}
        </ul>
      ) : empty ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">{children}</ul>
      )}
    </Card>
  );
}

// users: the newest users, or null while loading
export function RecentUsers({ users }) {
  return (
    <ListCard
      title="Recent users"
      link={{ to: "/users", label: "All users" }}
      loading={!users}
      empty={users?.length === 0 ? "No users yet." : null}
    >
      {users?.map((user) => (
        <li key={user.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <span className="truncate">{user.name}</span>
              {user.role === "admin" && <Badge tone="accent">Admin</Badge>}
            </p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted sm:shrink-0 sm:justify-end">
            {user.booksCount > 0 ? (
              <Link
                to={`/admin/books?userId=${user.id}`}
                state={{ ownerName: user.name }}
                className="inline-flex min-h-11 items-center font-medium text-ink underline focus-ring"
              >
                {user.booksCount} {user.booksCount === 1 ? "book" : "books"}
              </Link>
            ) : (
              <span>0 books</span>
            )}
            <span aria-hidden="true">·</span>
            <span>Joined {formatDate(user.createdAt)}</span>
          </p>
        </li>
      ))}
    </ListCard>
  );
}

// books: the newest books [{ id, title, author, genre, createdAt, owner: { id, name } }], or null while loading
export function RecentBooks({ books }) {
  return (
    <ListCard
      title="Recently added books"
      link={{ to: "/admin/books", label: "All books" }}
      loading={!books}
      empty={books?.length === 0 ? "No books added yet." : null}
    >
      {books?.map((book) => (
        <li key={book.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{book.title}</p>
            <p className="truncate text-sm text-muted">
              {book.author} · {book.genre}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted sm:shrink-0 sm:flex-col sm:items-end sm:gap-x-0">
            <Link
              to={`/admin/books?userId=${book.owner.id}`}
              state={{ ownerName: book.owner.name }}
              className="inline-flex min-h-11 items-center font-medium text-ink underline focus-ring"
            >
              {book.owner.name}
            </Link>
            <span aria-hidden="true" className="sm:hidden">
              ·
            </span>
            <span className="sm:-mt-2">{relativeTime(book.createdAt)}</span>
          </div>
        </li>
      ))}
    </ListCard>
  );
}
