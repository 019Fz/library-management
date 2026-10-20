// Bar chart "Books added, last 14 days": plain flex bars (no chart library).
//   days = [{ date, count }] (14 entries, oldest first), or null while loading
// Every value is printed above its bar, and the chart has a text alternative that lists all of them.
// The bar zone reserves LABEL_REM at the top of the fixed chart height, so the label of the tallest bar is never cut off.
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatCount, formatShortDay } from "../../lib/format.js";
import { chartBars, chartSummary, chartTotal } from "../../lib/dashboard.js";

const LABEL_REM = 1.25; // height of the value label above a bar
// Full class names, so Tailwind can see them
const SKELETON_HEIGHTS = [
  "h-[30%]", "h-[50%]", "h-[25%]", "h-[70%]", "h-[45%]", "h-[35%]", "h-[80%]",
  "h-[55%]", "h-[40%]", "h-[90%]", "h-[60%]", "h-[45%]", "h-[75%]", "h-[50%]",
];

export default function BooksPerDayChart({ days }) {
  const total = days ? chartTotal(days) : 0;

  let body;
  if (!days) {
    body = (
      <div aria-hidden="true" className="mt-4">
        <div className="flex h-40 items-end gap-1">
          {SKELETON_HEIGHTS.map((height, index) => (
            <Skeleton key={index} className={`min-w-0 flex-1 ${height}`} />
          ))}
        </div>
        <div className="mt-2 flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    );
  } else if (total === 0) {
    body = (
      <EmptyState
        icon="book"
        title="No books added yet"
        text="Books added in the last 14 days will show up here as a chart."
      />
    );
  } else {
    const bars = chartBars(days);
    body = (
      <div className="mt-4">
        <div role="img" aria-label={chartSummary(days)}>
          <div className="flex h-40 items-end gap-1 border-b border-line">
            {bars.map((bar) => (
              <div key={bar.date} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <span
                  className="block text-center text-xs text-ink"
                  style={{ height: `${LABEL_REM}rem`, lineHeight: `${LABEL_REM}rem` }}
                >
                  {formatCount(bar.count)}
                </span>
                {/* The bar fills its share of the space under the label */}
                <div
                  className="rounded-t bg-accent"
                  style={{ height: `calc((100% - ${LABEL_REM}rem) * ${bar.percent / 100})` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{formatShortDay(days[0].date)}</span>
            <span>{formatShortDay(days[days.length - 1].date)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Books added, last 14 days</h2>
        {days && total > 0 && <p className="shrink-0 text-sm text-muted">{formatCount(total)} books added</p>}
      </div>
      {body}
    </Card>
  );
}
