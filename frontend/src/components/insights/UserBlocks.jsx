// The blocks of a user's insights (their own, or one picked by an admin). Each takes null while loading
// and then shows skeletons of the same size, so nothing jumps.
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import ErrorBox from "../ui/ErrorBox.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StackedBar, { SegmentLegend } from "./StackedBar.jsx";
import { formatCount, formatPrice } from "../../lib/format.js";
import { completionPercent, percentLabel, reasonText, scaleBars, stackedSegments } from "../../lib/insights.js";

// The backend's one-sentence summary, as a dark band
export function SummaryBand({ summary }) {
  return (
    <div className="rounded-card bg-ink p-6 text-on-ink">
      {summary === null ? (
        <Skeleton className="h-14 w-full max-w-xl" />
      ) : (
        <p className="max-w-3xl text-lg font-semibold sm:text-xl">{summary}</p>
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-1 h-9">
        {value === null ? <Skeleton className="h-8 w-24" /> : <p className="truncate text-3xl font-bold leading-9 text-ink">{value}</p>}
      </div>
    </Card>
  );
}

// data = the insights object, or null while loading. The completion rate uses the same
// number as the "Completed" entry of the status legend (stackedSegments).
export function MetricCards({ data }) {
  return (
    <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Completion rate" value={data ? percentLabel(completionPercent(data.statusCounts)) : null} />
      <MetricCard label="Average price" value={data ? formatPrice(data.averagePrice) : null} />
      <MetricCard
        label="Most expensive"
        value={data ? (data.mostExpensive === null ? "-" : formatPrice(data.mostExpensive)) : null}
      />
      <MetricCard label="Still to read" value={data ? formatCount(data.statusCounts["to-read"]) : null} />
    </section>
  );
}

// counts = statusCounts, or null while loading
export function StatusCard({ counts }) {
  const segments = counts ? stackedSegments(counts) : null;
  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Reading status</h2>
      {segments ? (
        <div className="mt-4 space-y-3">
          <StackedBar segments={segments} />
          <SegmentLegend segments={segments} />
        </div>
      ) : (
        <div aria-hidden="true" className="mt-4 space-y-3">
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      )}
    </Card>
  );
}

// genres = [{ genre, count }], or null while loading. Bars are decorative: the counts are printed.
// title: "Your top genres" for the user's own view, "Top genres" when an admin looks at someone else.
export function TopGenresCard({ genres, title = "Your top genres" }) {
  const rows = genres ? scaleBars(genres) : null;
  const label = rows ? `Top genres: ${rows.map((row) => `${row.genre} ${row.count}`).join(", ")}` : undefined;

  let body;
  if (!rows) {
    body = (
      <div aria-hidden="true" className="mt-4 space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index}>
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-2 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    body = <p className="mt-3 text-muted">No genres yet.</p>;
  } else {
    body = (
      <div role="img" aria-label={label} className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.genre}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium text-ink">{row.genre}</span>
              <span className="shrink-0 text-sm font-semibold text-ink">{formatCount(row.count)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-line">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {body}
    </Card>
  );
}

// items = [{ title, author, genre, price, owners, reason }], or null while loading
//   error / onRetry = a failed request (shown inside this card only)
//   onAdd(item, button) = "Add to my library" was clicked
export function Recommendations({ items, error, onRetry, onAdd }) {
  let body;
  if (error) {
    body = (
      <div className="mt-4 space-y-3">
        <ErrorBox message={error.message} details={error.details} />
        <Button variant="outlined" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (!items) {
    body = (
      <div aria-hidden="true" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-card border border-line p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-4 h-11 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  } else if (items.length === 0) {
    body = <p className="mt-4 text-muted">No recommendations right now. Check back when more readers have added books.</p>;
  } else {
    body = (
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.title} className="flex flex-col rounded-card border border-line p-4">
            <p className="font-semibold text-ink">{item.title}</p>
            <p className="text-sm text-muted">
              {item.author} · {item.genre}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{formatPrice(item.price)}</p>
            <p className="mt-2 flex-1 text-sm text-muted">{reasonText(item)}</p>
            <Button
              fullWidth
              className="mt-4"
              aria-label={`Add ${item.title} to my library`}
              onClick={(event) => onAdd(item, event.currentTarget)}
            >
              Add to my library
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Recommended for you</h2>
      <p className="text-sm text-muted">Popular with other readers and not in your library yet.</p>
      {body}
    </Card>
  );
}
