// Pure helpers for the Insights page (no React, easy to test).
import { positiveInt } from "./listQuery.js";
import { STATUS_LABELS } from "./format.js";

// Fixed order of the status bars: completed, reading, to read
const STATUS_KEYS = ["completed", "reading", "to-read"];

// counts = { reading, completed, "to-read" } -> one entry per status:
//   count   = exact number of books
//   percent = whole number for the labels; the three always add up to exactly 100
//             (largest remainder: each gets its rounded-down share, the leftover points go to the biggest remainders)
//   width   = the exact share (0-100) for the bar
// With no books every value is 0.
export function stackedSegments(counts) {
  const items = STATUS_KEYS.map((key) => ({
    key,
    label: STATUS_LABELS[key],
    count: Math.max(0, Number(counts?.[key]) || 0),
  }));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return items.map((item) => ({ ...item, percent: 0, width: 0 }));

  const percents = items.map((item) => Math.floor((item.count * 100) / total));
  let leftover = 100 - percents.reduce((sum, p) => sum + p, 0);
  // Integer remainders (no rounding errors); on a tie the earlier status gets the point
  const byRemainder = items
    .map((item, index) => ({ index, remainder: (item.count * 100) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (leftover === 0) break;
    percents[index] += 1;
    leftover -= 1;
  }

  return items.map((item, index) => ({
    ...item,
    percent: percents[index],
    width: (item.count * 100) / total,
  }));
}

// The completion rate shown on the metric card: the same number as the "Completed" legend entry
export function completionPercent(counts) {
  return stackedSegments(counts).find((segment) => segment.key === "completed").percent;
}

// Text alternative of a status bar: "Completed 10 (42%), Reading 6 (25%), To read 8 (33%)"
export function describeSegments(segments) {
  return segments.map((s) => `${s.label} ${s.count} (${s.percent}%)`).join(", ");
}

const MIN_BAR_PERCENT = 4; // a bar with a value is always visible

// items = [{ count, ... }] -> the same items with "percent": the bar height or width as a share of the biggest
// count (0 for every item when all counts are 0)
export function scaleBars(items) {
  if (!Array.isArray(items)) return [];
  const max = Math.max(0, ...items.map((item) => item.count));
  return items.map((item) => {
    let percent = max > 0 ? Math.round((item.count / max) * 100) : 0;
    if (item.count > 0) percent = Math.max(percent, MIN_BAR_PERCENT);
    return { ...item, percent };
  });
}

const BUCKET_LABELS = { "<10": "Under 10" };

// buckets = [{ label, count }] from the API -> [{ label, count, percent }] with readable labels
export function bucketBars(buckets) {
  if (!Array.isArray(buckets)) return [];
  return scaleBars(buckets).map(({ label, count, percent }) => ({
    label: BUCKET_LABELS[label] ?? label,
    count,
    percent,
  }));
}

// "42%": whole number, kept between 0 and 100, anything that is not a number counts as 0
export function percentLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${Math.min(100, Math.max(0, Math.round(number)))}%`;
}

// Which view the URL asks for. params = URLSearchParams (?view=user&userId=7).
//   normal user: always "self" (anything in the URL is ignored)
//   admin:       "platform" unless ?view=user; the user id counts only when it is a positive integer
// ?view=user without a valid id is the "choose a user" state.
export function parseInsightsParams(params, role) {
  if (role !== "admin") return { mode: "self", userId: null };
  if (params.get("view") !== "user") return { mode: "platform", userId: null };
  const id = params.get("userId") ?? "";
  return { mode: "user", userId: positiveInt(id) ? Number(id) : null };
}

// The reason line of a recommendation: the backend's text, or a plain fallback built from the owner count
export function reasonText(item) {
  if (typeof item?.reason === "string" && item.reason.trim()) return item.reason;
  const owners = Number(item?.owners);
  if (!Number.isFinite(owners) || owners < 1) return "Popular with other readers.";
  return `Owned by ${owners} ${owners === 1 ? "reader" : "readers"}.`;
}
