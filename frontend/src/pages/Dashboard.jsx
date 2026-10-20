// Admin dashboard: what is happening now (GET /api/admin/stats). Totals with this week's changes, what needs
// attention, books added per day, books by status, and the newest users and books.
// Patterns and comparisons (genres, prices, completion) belong to the Insights page, not here.
// The numbers are loaded every time the page opens, so they are current after changes on other pages.
import { usePageTitle } from "../lib/usePageTitle.js";
import { useList } from "../lib/useBooks.js";
import { formatCount, formatPrice } from "../lib/format.js";
import { weeklyDeltaLabel } from "../lib/dashboard.js";
import StatCard from "../components/admin/StatCard.jsx";
import AttentionStrip from "../components/admin/AttentionStrip.jsx";
import BooksPerDayChart from "../components/admin/BooksPerDayChart.jsx";
import StatusDonut from "../components/admin/StatusDonut.jsx";
import DataError from "../components/admin/DataError.jsx";
import { RecentUsers, RecentBooks } from "../components/admin/DashboardLists.jsx";

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { loading, error, data, retry } = useList("/api/admin/stats", "");

  // null while loading, so every card shows its skeleton
  const stats = loading ? null : data;
  const accounts = stats?.totals.users;

  return (
    <>
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink focus-ring">
        Dashboard
      </h1>

      {error ? (
        <div className="mt-4">
          <DataError error={error} onRetry={retry} />
        </div>
      ) : (
        <div className="mt-4 space-y-4" aria-busy={loading || undefined}>
          {loading && (
            <p role="status" className="sr-only">
              Loading dashboard...
            </p>
          )}

          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon="users"
              label="Users"
              to="/users"
              value={stats ? formatCount(stats.totals.users) : null}
              badge={stats ? weeklyDeltaLabel(stats.newUsers7d) : null}
              note={stats ? `incl. ${stats.totals.admins} ${stats.totals.admins === 1 ? "admin" : "admins"}` : null}
            />
            <StatCard
              icon="book"
              label="Books"
              to="/admin/books"
              value={stats ? formatCount(stats.totals.books) : null}
              badge={stats ? weeklyDeltaLabel(stats.newBooks7d) : null}
              note="across all users"
            />
            <StatCard
              icon="coins"
              label="Library value"
              to="/admin/books?sort=price&order=desc"
              value={stats ? formatPrice(stats.libraryValue) : null}
              note="sum of all book prices"
            />
            <StatCard
              icon="shield"
              label="Admins"
              to="/users?role=admin"
              value={stats ? formatCount(stats.totals.admins) : null}
              note={stats ? `of ${formatCount(accounts)} ${accounts === 1 ? "account" : "accounts"}` : null}
            />
          </section>

          <AttentionStrip attention={stats ? stats.attention : null} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BooksPerDayChart days={stats ? stats.booksPerDay : null} />
            </div>
            <StatusDonut counts={stats ? stats.booksByStatus : null} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentUsers users={stats ? stats.recentUsers : null} />
            <RecentBooks books={stats ? stats.recentBooks : null} />
          </div>
        </div>
      )}
    </>
  );
}
