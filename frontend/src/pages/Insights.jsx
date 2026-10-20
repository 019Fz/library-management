// Insights: what the data means. One page for every role.
//   normal user: their own insights and recommended books ("Add to my library")
//   admin:       ?view=user&userId=<id> shows one user's insights; anything else shows the Platform view
// All text comes from the backend (built from numbers). Charts are plain flex/div bars with printed numbers.
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import { useList } from "../lib/useBooks.js";
import { useDialogState } from "../lib/useDialogState.js";
import { parseInsightsParams } from "../lib/insights.js";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast } from "../components/ui/toast-context.js";
import DataError from "../components/admin/DataError.jsx";
import BookFormDialog from "../components/books/BookFormDialog.jsx";
import ViewSwitch from "../components/insights/ViewSwitch.jsx";
import UserPicker from "../components/insights/UserPicker.jsx";
import { SummaryBand, MetricCards, StatusCard, TopGenresCard, Recommendations } from "../components/insights/UserBlocks.jsx";
import {
  WhatStandsOut,
  GenreStatusCard,
  PriceCard,
  CompletionByUser,
  PopularTitles,
} from "../components/insights/PlatformBlocks.jsx";

// Visible only to screen readers while a view loads (the charts themselves are never live regions)
function LoadingStatus({ loading }) {
  return loading ? (
    <p role="status" className="sr-only">
      Loading insights...
    </p>
  ) : null;
}

// ---------- a normal user's own insights ----------

function SelfInsights({ dialog, openDialog, closeDialog, closeToHeading, getReturnFocus }) {
  const me = useList("/api/insights/me", "");
  const recs = useList("/api/insights/recommendations", "");
  const toast = useToast();

  const data = me.loading ? null : me.data;

  function handleSaved() {
    closeToHeading(); // the recommended book disappears after the reload, so focus goes to the heading
    me.refetch();
    recs.refetch();
    toast.success("Added to your library");
  }

  const recommendations = (
    <Recommendations
      items={recs.loading ? null : (recs.data?.recommendations ?? null)}
      error={recs.error}
      onRetry={recs.retry}
      onAdd={(item, button) => openDialog({ type: "add", item }, button)}
    />
  );

  let content;
  if (me.error) {
    content = <DataError error={me.error} onRetry={me.retry} />;
  } else if (data && data.totalBooks === 0) {
    content = (
      <>
        <Card>
          <EmptyState
            icon="book"
            title="Your library is empty"
            text="Add a few books and your insights will appear here."
            action={<Button to="/books">Add your first book</Button>}
          />
        </Card>
        {recommendations}
      </>
    );
  } else {
    content = (
      <>
        <SummaryBand summary={data ? data.summary : null} />
        <MetricCards data={data} />
        <div className="grid gap-4 lg:grid-cols-2">
          <StatusCard counts={data ? data.statusCounts : null} />
          <TopGenresCard genres={data ? data.topGenres : null} />
        </div>
        {recommendations}
      </>
    );
  }

  const item = dialog?.type === "add" ? dialog.item : null;
  return (
    <div className="space-y-4" aria-busy={me.loading || undefined}>
      <LoadingStatus loading={me.loading} />
      {content}
      <BookFormDialog
        open={dialog?.type === "add"}
        book={null}
        initialValues={item ? { title: item.title, author: item.author, genre: item.genre, price: item.price, status: "to-read" } : undefined}
        genres={data ? data.topGenres.map((g) => g.genre) : null}
        onClose={closeDialog}
        onSaved={handleSaved}
        onGone={() => {}}
        getReturnFocus={getReturnFocus}
      />
    </div>
  );
}

// ---------- admin: the whole platform ----------

function PlatformInsights() {
  const { loading, error, data, retry } = useList("/api/admin/insights", "");
  const stats = loading ? null : data;

  if (error) return <DataError error={error} onRetry={retry} />;

  // No books on the platform: the three sentences are already friendly, so show them and one empty state
  const empty = stats && stats.topGenres.length === 0;

  return (
    <div className="space-y-4" aria-busy={loading || undefined}>
      <LoadingStatus loading={loading} />
      <WhatStandsOut sentences={stats ? stats.insights : null} />
      {empty ? (
        <Card>
          <EmptyState icon="book" title="No books on the platform yet" text="Charts appear here once users add books." />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <GenreStatusCard rows={stats ? stats.statusByGenre : null} />
            <PriceCard buckets={stats ? stats.priceBuckets : null} averages={stats ? stats.averagePriceByGenre : null} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <CompletionByUser rows={stats ? stats.completionByUser : null} />
            <PopularTitles titles={stats ? stats.popularTitles : null} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------- admin: one user ----------

// The insights of the chosen user (the same shape as a user's own, but no recommendations)
function UserDetail({ userId }) {
  const { loading, error, data, retry } = useList(`/api/admin/users/${userId}/insights`, "");
  const stats = loading ? null : data;

  if (error) return <DataError error={error} onRetry={retry} />;

  return (
    <div className="space-y-4" aria-busy={loading || undefined}>
      <LoadingStatus loading={loading} />
      <SummaryBand summary={stats ? stats.summary : null} />
      {stats && stats.totalBooks === 0 ? (
        <Card>
          <p className="text-muted">There is nothing to chart yet.</p>
        </Card>
      ) : (
        <>
          <MetricCards data={stats} />
          <div className="grid gap-4 lg:grid-cols-2">
            <StatusCard counts={stats ? stats.statusCounts : null} />
            <TopGenresCard genres={stats ? stats.topGenres : null} title="Top genres" />
          </div>
        </>
      )}
    </div>
  );
}

function OtherUserInsights({ userId, onSelect }) {
  return (
    <div className="space-y-4">
      <UserPicker selectedId={userId} onSelect={onSelect} />
      {userId ? (
        <UserDetail key={userId} userId={userId} />
      ) : (
        <p className="text-muted">Choose a user to see their insights.</p>
      )}
    </div>
  );
}

// ---------- the page ----------

export default function Insights() {
  usePageTitle("Insights");
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { dialog, open, close, closeToHeading, getReturnFocus, headingRef } = useDialogState();

  const { mode, userId } = parseInsightsParams(searchParams, user.role);

  // The name of the chosen user is only known when they were picked in this session
  const userName = location.state?.userName ?? (userId ? `User #${userId}` : "");

  function handleSelect(id, name) {
    navigate(`/insights?view=user&userId=${id}`, { state: { userName: name } });
  }

  let status = "";
  if (mode === "platform") status = "Showing platform insights";
  else if (mode === "user") status = userId ? `Showing insights for ${userName}` : "Choose a user";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink focus-ring">
            {mode === "self" ? "My insights" : "Insights"}
          </h1>
          <p className="text-sm text-muted">
            {mode === "self"
              ? "A look at your own reading and your library"
              : "What the data says about how the library is used"}
          </p>
        </div>
        {mode !== "self" && <ViewSwitch mode={mode} userId={userId} />}
      </div>
      {/* Status text only: it is announced when the view changes */}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="mt-4">
        {mode === "self" && (
          <SelfInsights
            dialog={dialog}
            openDialog={open}
            closeDialog={close}
            closeToHeading={closeToHeading}
            getReturnFocus={getReturnFocus}
          />
        )}
        {mode === "platform" && <PlatformInsights />}
        {mode === "user" && <OtherUserInsights userId={userId} onSelect={handleSelect} />}
      </div>
    </>
  );
}
