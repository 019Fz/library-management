// Pure helpers for the admin dashboard (no React, easy to test).
import { formatCount, formatDate, formatShortDay } from "./format.js";

const MIN_BAR_PERCENT = 4; // a day with books always gets a visible bar

// days = [{ date, count }] -> [{ date, count, percent }]: bar height as a share of the biggest day.
// When every day is 0 all heights are 0 (never a division by zero).
export function chartBars(days) {
  if (!Array.isArray(days)) return [];
  const max = Math.max(0, ...days.map((day) => day.count));
  return days.map((day) => {
    let percent = max > 0 ? Math.round((day.count / max) * 100) : 0;
    if (day.count > 0) percent = Math.max(percent, MIN_BAR_PERCENT);
    return { date: day.date, count: day.count, percent };
  });
}

export function chartTotal(days) {
  return Array.isArray(days) ? days.reduce((sum, day) => sum + day.count, 0) : 0;
}

// Text alternative of the chart: every value with its date
export function chartSummary(days) {
  const values = days.map((day) => `${formatShortDay(day.date)}: ${day.count}`).join(", ");
  return `Books added per day, last ${days.length} days: ${values}. ${formatCount(chartTotal(days))} books in total.`;
}

// "+6 this week", or null when there is nothing to show (0, negative or not a number)
export function weeklyDeltaLabel(count) {
  return Number.isFinite(count) && count > 0 ? `+${formatCount(count)} this week` : null;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "Just now", "5 min ago", "2 h ago", "Yesterday", otherwise the date. now can be passed in for tests.
export function relativeTime(iso, now = new Date()) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const age = now.getTime() - then.getTime();
  if (age < MINUTE) return "Just now"; // also a time a little in the future (clock differences)
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return then.toDateString() === yesterday.toDateString() ? "Yesterday" : formatDate(iso);
}

// attention = { usersWithoutBooks, newUsersLast48h } -> the lines of the "Needs attention" strip.
// Zero (or missing) numbers are left out. Links: the users list sorted so these users come first.
export function attentionItems(attention) {
  const items = [];
  const noBooks = attention?.usersWithoutBooks;
  const joined = attention?.newUsersLast48h;
  if (noBooks > 0) {
    items.push({
      key: "no-books",
      text: `${formatCount(noBooks)} ${noBooks === 1 ? "user has" : "users have"} no books yet`,
      to: "/users?sort=books&order=asc",
    });
  }
  if (joined > 0) {
    items.push({
      key: "new-users",
      text: `${formatCount(joined)} ${joined === 1 ? "user" : "users"} joined in the last 48 hours`,
      to: "/users", // the default sort is newest first
    });
  }
  return items;
}
