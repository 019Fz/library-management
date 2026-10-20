// The blocks of the admin Platform view. Each takes null while loading and then shows skeletons.
// Numbers are always printed; bars are drawn with plain flex/div (no chart library).
import Card from "../ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StackedBar, { StatusKey } from "./StackedBar.jsx";
import { CURRENCY, formatCount, formatPrice } from "../../lib/format.js";
import { bucketBars, describeSegments, percentLabel, stackedSegments } from "../../lib/insights.js";

function CardTitle({ title, subtitle }) {
  return (
    <>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </>
  );
}

// sentences = the 3 backend sentences, or null while loading. The first one is the biggest.
export function WhatStandsOut({ sentences }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">What stands out</h2>
      {sentences ? (
        <div className="mt-3 space-y-3">
          {sentences.map((sentence, index) => (
            <p key={index} className={`font-semibold text-ink ${index === 0 ? "text-xl sm:text-2xl" : "text-lg"}`}>
              {sentence}
            </p>
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className="mt-3 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-3/5" />
        </div>
      )}
    </Card>
  );
}

// rows = statusByGenre [{ genre, reading, completed, "to-read" }], or null while loading
export function GenreStatusCard({ rows }) {
  let body;
  if (!rows) {
    body = (
      <div aria-hidden="true" className="mt-4 space-y-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index}>
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-2 h-4 w-full rounded-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    body = <p className="mt-4 text-muted">No genres yet.</p>;
  } else {
    body = (
      <div className="mt-4 space-y-5">
        {rows.map((row) => {
          const segments = stackedSegments(row);
          const total = segments.reduce((sum, s) => sum + s.count, 0);
          return (
            <div key={row.genre}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-ink">{row.genre}</span>
                <span className="shrink-0 text-sm text-muted">
                  {formatCount(total)} {total === 1 ? "book" : "books"}
                </span>
              </div>
              <div className="mt-1">
                <StackedBar segments={segments} label={`${row.genre}: ${describeSegments(segments)}, ${total} books`} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {segments.map((s) => `${s.percent}% ${s.label.toLowerCase()}`).join(" · ")}
              </p>
            </div>
          );
        })}
        <StatusKey />
      </div>
    );
  }

  return (
    <Card>
      <CardTitle title="Reading status by genre" subtitle="Share of books in each status" />
      {body}
    </Card>
  );
}

const LABEL_REM = 1.25; // height of the value label above a bar (reserved inside the chart height)

// buckets = priceBuckets [{ label, count }], averages = averagePriceByGenre [{ genre, averagePrice }], or null while loading
export function PriceCard({ buckets, averages }) {
  let chart;
  if (!buckets) {
    chart = (
      <div aria-hidden="true" className="mt-4 flex h-40 items-end gap-2">
        {["h-[40%]", "h-[80%]", "h-[55%]", "h-[30%]", "h-[15%]"].map((height) => (
          <Skeleton key={height} className={`min-w-0 flex-1 ${height}`} />
        ))}
      </div>
    );
  } else {
    const bars = bucketBars(buckets);
    const label = `Price distribution: ${bars.map((bar) => `${bar.label} ${bar.count}`).join(", ")}`;
    chart = (
      <div role="img" aria-label={label} className="mt-4">
        <div className="flex h-40 items-end gap-2 border-b border-line">
          {bars.map((bar) => (
            <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span
                className="block text-center text-xs text-ink"
                style={{ height: `${LABEL_REM}rem`, lineHeight: `${LABEL_REM}rem` }}
              >
                {formatCount(bar.count)}
              </span>
              <div
                className="rounded-t bg-accent"
                style={{ height: `calc((100% - ${LABEL_REM}rem) * ${bar.percent / 100})` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 text-center text-xs text-muted">
          {bars.map((bar) => (
            <span key={bar.label} className="min-w-0 flex-1">
              {bar.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardTitle title="Price distribution" subtitle={`How many books fall in each price range (${CURRENCY})`} />
      {chart}
      <h3 className="mt-6 text-sm font-semibold text-ink">Average price by genre</h3>
      {!averages ? (
        <div aria-hidden="true" className="mt-2 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : averages.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No genres yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {averages.map((item) => (
            <li key={item.genre} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">{item.genre}</span>
              <span className="shrink-0 font-semibold text-ink">{formatPrice(item.averagePrice)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// rows = completionByUser [{ id, name, books, completed, completionRate }], or null while loading
export function CompletionByUser({ rows }) {
  let body;
  if (!rows) {
    body = (
      <ul aria-hidden="true" className="mt-4 space-y-4">
        {[0, 1, 2, 3].map((index) => (
          <li key={index}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-full rounded-full" />
          </li>
        ))}
      </ul>
    );
  } else if (rows.length === 0) {
    body = <p className="mt-4 text-muted">No user has 5 books yet.</p>;
  } else {
    body = (
      <ul className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium text-ink">{row.name}</span>
              <span className="shrink-0 text-sm text-muted">
                {formatCount(row.books)} books · {formatCount(row.completed)} completed
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div aria-hidden="true" className="h-2 flex-1 rounded-full bg-line">
                <div className="h-2 rounded-full bg-completed" style={{ width: `${Math.min(100, Math.max(0, row.completionRate))}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-sm font-semibold text-ink">{percentLabel(row.completionRate)}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <CardTitle title="Completion by user" subtitle="Users with at least 5 books" />
      {body}
    </Card>
  );
}

// titles = popularTitles [{ title, owners }], or null while loading
export function PopularTitles({ titles }) {
  let body;
  if (!titles) {
    body = (
      <ul aria-hidden="true" className="mt-4 space-y-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <li key={index}>
            <Skeleton className="h-6 w-full" />
          </li>
        ))}
      </ul>
    );
  } else if (titles.length === 0) {
    body = <p className="mt-4 text-muted">No books yet.</p>;
  } else {
    body = (
      <ol className="mt-4 divide-y divide-line">
        {titles.map((item, index) => (
          <li key={item.title} className="flex items-center gap-4 py-3">
            <span aria-hidden="true" className="w-5 shrink-0 text-muted">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{item.title}</span>
            <span className="shrink-0 text-sm font-semibold text-ink">
              {formatCount(item.owners)} {item.owners === 1 ? "owner" : "owners"}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Card>
      <CardTitle title="Most shared titles" subtitle="Owned by the most different users" />
      {body}
    </Card>
  );
}
