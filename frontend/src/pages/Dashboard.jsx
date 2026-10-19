// Admin dashboard: totals, books by status, recent users, admins and top genres (GET /api/admin/stats).
// The numbers are loaded every time the page opens, so they are current after changes on other pages.
import { usePageTitle } from "../lib/usePageTitle.js";
import { useList } from "../lib/useBooks.js";
import { useAuth } from "../context/useAuth.js";
import { formatCount, formatPrice } from "../lib/format.js";
import StatCard from "../components/admin/StatCard.jsx";
import StatusDonut from "../components/admin/StatusDonut.jsx";
import DataError from "../components/admin/DataError.jsx";
import { RecentUsers, AdminList, TopGenres } from "../components/admin/DashboardLists.jsx";

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user } = useAuth();
  const { loading, error, data, retry } = useList("/api/admin/stats", "");

  // null while loading, so every card shows its skeleton
  const stats = loading ? null : data;

  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

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
              value={stats ? formatCount(stats.totals.users) : null}
              note={stats ? `incl. ${stats.totals.admins} ${stats.totals.admins === 1 ? "admin" : "admins"}` : null}
            />
            <StatCard
              icon="shield"
              label="Admins"
              value={stats ? formatCount(stats.totals.admins) : null}
              note="can manage everything"
            />
            <StatCard
              icon="book"
              label="Books"
              value={stats ? formatCount(stats.totals.books) : null}
              note="across all users"
            />
            <StatCard
              icon="coins"
              label="Library value"
              value={stats ? formatPrice(stats.libraryValue) : null}
              note="sum of all book prices"
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <StatusDonut counts={stats ? stats.booksByStatus : null} />
            <div className="lg:col-span-2">
              <RecentUsers users={stats ? stats.recentUsers : null} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminList admins={stats ? stats.admins : null} currentUserId={user.id} />
            <TopGenres genres={stats ? stats.topGenres : null} />
          </div>
        </div>
      )}
    </>
  );
}
