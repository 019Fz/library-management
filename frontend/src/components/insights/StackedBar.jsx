// One stacked bar of reading statuses, drawn with plain flex segments (no chart library).
//   segments = the result of stackedSegments(counts)
//   label    = text alternative that lists every value (the bar is role="img")
// Colour never carries the meaning alone: the legend or caption next to the bar prints label, count and percent.
import { describeSegments } from "../../lib/insights.js";
import { STATUS_LABELS } from "../../lib/format.js";

const STATUS_KEYS = ["completed", "reading", "to-read"];

// Full class names, so Tailwind can see them. All colors are status tokens.
const SEGMENT_BG = { completed: "bg-completed", reading: "bg-reading", "to-read": "bg-to-read" };

export default function StackedBar({ segments, label }) {
  return (
    <div role="img" aria-label={label ?? describeSegments(segments)} className="flex h-4 overflow-hidden rounded-full bg-line">
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <div key={segment.key} className={`h-full ${SEGMENT_BG[segment.key]}`} style={{ width: `${segment.width}%` }} />
        ))}
    </div>
  );
}

// A key for several bars (dot and label only; each bar prints its own numbers)
export function StatusKey() {
  return (
    <ul aria-label="Status colors" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {STATUS_KEYS.map((key) => (
        <li key={key} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${SEGMENT_BG[key]}`} />
          <span className="text-muted">{STATUS_LABELS[key]}</span>
        </li>
      ))}
    </ul>
  );
}

// The legend under a bar: dot, label, exact count and percent
export function SegmentLegend({ segments }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {segments.map((segment) => (
        <li key={segment.key} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${SEGMENT_BG[segment.key]}`} />
          <span className="font-medium text-ink">{segment.label}</span>
          <span className="text-muted">
            {segment.count} · {segment.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}
