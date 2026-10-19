// Donut chart of books by status, drawn as inline SVG (no chart library).
//   counts = { reading, completed, "to-read" }, or null while loading
// Color never carries the meaning alone: the legend prints every status with its exact count and
// the (rounded) percentage, and the SVG has a text alternative that says the same.
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { STATUS_LABELS, formatCount } from "../../lib/format.js";
import { donutSegments } from "../../lib/donut.js";

// Full class names, so Tailwind can see them. All colors are status tokens.
const STROKE = { reading: "stroke-reading", completed: "stroke-completed", "to-read": "stroke-to-read" };
const DOT = { reading: "bg-reading", completed: "bg-completed", "to-read": "bg-to-read" };

const RADIUS = 15.9155; // circumference = 100, so a segment length is a percentage
const SIZE = "h-44 w-44";

export default function StatusDonut({ counts }) {
  const segments = counts ? donutSegments(counts) : [];
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  let body;
  if (!counts) {
    body = (
      <div aria-hidden="true" className="mt-4 flex flex-col items-center gap-6">
        <Skeleton className={`${SIZE} shrink-0 rounded-full`} />
        <div className="w-full max-w-xs space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    );
  } else if (total === 0) {
    body = <EmptyState icon="book" title="No books yet" text="When users add books, their status split shows up here." />;
  } else {
    const summary = segments
      .map((s) => `${STATUS_LABELS[s.key]} ${formatCount(s.count)} (${s.percent}%)`)
      .join(", ");

    body = (
      // The donut sits above its legend at every width, so the legend always has the full card width
      <div className="mt-4 flex flex-col items-center gap-6">
        <div className={`relative ${SIZE} shrink-0`}>
          <svg
            viewBox="0 0 40 40"
            role="img"
            aria-label={`Books by status: ${summary}. ${formatCount(total)} books in total.`}
            className="h-full w-full -rotate-90"
          >
            <circle cx="20" cy="20" r={RADIUS} fill="none" strokeWidth="6" className="stroke-line" />
            {segments
              .filter((segment) => segment.count > 0)
              .map((segment) => (
                <circle
                  key={segment.key}
                  cx="20"
                  cy="20"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="6"
                  strokeDasharray={`${segment.length} ${100 - segment.length}`}
                  strokeDashoffset={-segment.offset}
                  className={STROKE[segment.key]}
                />
              ))}
          </svg>
          <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-ink">{formatCount(total)}</span>
            <span className="text-xs text-muted">books</span>
          </div>
        </div>

        <ul className="w-full max-w-xs space-y-2">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-3 text-sm">
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${DOT[segment.key]}`} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{STATUS_LABELS[segment.key]}</span>
              <span className="shrink-0 text-ink">{formatCount(segment.count)}</span>
              <span className="w-12 shrink-0 text-right text-muted">{segment.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Books by status</h2>
      {body}
    </Card>
  );
}
