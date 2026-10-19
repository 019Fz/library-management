// The three list cards of the dashboard. Each takes null while loading and then shows
// skeleton rows with the same count as the real list (5), so nothing jumps.
import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Icon from "../ui/Icon.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatDate } from "../../lib/format.js";

const ROWS = 5;

function ListCard({ title, loading, empty, children }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {loading ? (
        <ul aria-hidden="true" className="mt-3 divide-y divide-line">
          {Array.from({ length: ROWS }, (_, index) => (
            <li key={index} className="py-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </li>
          ))}
        </ul>
      ) : empty ? (
        <p className="mt-3 text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">{children}</ul>
      )}
    </Card>
  );
}

// users: the newest users, or null while loading
export function RecentUsers({ users }) {
  return (
    <ListCard title="Recent users" loading={!users} empty={users?.length === 0 ? "No users yet." : null}>
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

// admins: all admins, or null while loading. currentUserId marks the signed-in admin.
export function AdminList({ admins, currentUserId }) {
  return (
    <ListCard title="Admins" loading={!admins} empty={admins?.length === 0 ? "No admins." : null}>
      {admins?.map((admin) => (
        <li key={admin.id} className="flex items-center gap-3 py-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-accent-soft text-ink">
            <Icon name="shield" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <span className="truncate">{admin.name}</span>
              {admin.id === currentUserId && <Badge tone="accent">You</Badge>}
            </p>
            <p className="truncate text-sm text-muted">{admin.email}</p>
            <p className="text-sm text-muted">Admin since {formatDate(admin.createdAt)}</p>
          </div>
        </li>
      ))}
    </ListCard>
  );
}

// genres: [{ genre, count }] sorted by count, or null while loading. Bars are decorative: counts are printed.
export function TopGenres({ genres }) {
  const max = genres?.length ? Math.max(...genres.map((item) => item.count)) : 1;

  return (
    <ListCard title="Top genres" loading={!genres} empty={genres?.length === 0 ? "No books yet, so no genres." : null}>
      {genres?.map((item) => (
        <li key={item.genre} className="py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium text-ink">{item.genre}</span>
            <span className="shrink-0 text-sm text-muted">
              {item.count} {item.count === 1 ? "book" : "books"}
            </span>
          </div>
          <div aria-hidden="true" className="mt-2 h-2 rounded-full bg-line">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ListCard>
  );
}
