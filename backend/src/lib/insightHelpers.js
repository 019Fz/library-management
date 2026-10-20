// Pure helpers for the insights endpoints: percentages, day lists, genre merging and the sentences.
// No database access here, so everything is easy to test. All text is built from numbers.
import { fromDbStatus } from "./bookStatus.js";

// Whole-number percentage 0..100 (0 when there is nothing to divide by)
export function percent(part, total) {
  return total > 0 ? Math.round((part * 100) / total) : 0;
}

// A money value rounded to 2 decimals (for sums and averages worked out in JS from grouped numbers)
export const round2 = (value) => Number(Number(value).toFixed(2));

// "YYYY-MM-DD" (UTC) of a Date
export const dayKey = (date) => date.toISOString().slice(0, 10);

// The last `days` calendar days (UTC), oldest first, ending with `today` ("YYYY-MM-DD")
export function lastDays(today, days) {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => dayKey(new Date(end - (days - 1 - i) * 86400000)));
}

// Grouped rows [{ day, count }] -> exactly `days` entries [{ date, count }], zeros filled in
export function fillDays(rows, days, today) {
  const counts = new Map(rows.map((row) => [row.day, Number(row.count)]));
  return lastDays(today, days).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

// Price buckets as half-open ranges: gte <= price < lt (no lt = no upper limit)
export const PRICE_BUCKETS = [
  { label: "<10", lt: 10 },
  { label: "10-20", gte: 10, lt: 20 },
  { label: "20-30", gte: 20, lt: 30 },
  { label: "30-50", gte: 30, lt: 50 },
  { label: "50+", gte: 50 },
];

// groupBy rows by [genre, status] (with _count and _sum.price) -> one entry per genre, spellings that
// differ only by case merged (capitalised spelling kept), biggest first.
// Entry: { genre, count, reading, completed, "to-read", sum }
export function mergeGenres(rows) {
  const sorted = [...rows].sort((a, b) => (a.genre < b.genre ? -1 : a.genre > b.genre ? 1 : 0));
  const byLowercase = new Map();
  for (const row of sorted) {
    const key = row.genre.toLowerCase();
    let entry = byLowercase.get(key);
    if (!entry) {
      entry = { genre: row.genre, count: 0, reading: 0, completed: 0, "to-read": 0, sum: 0 };
      byLowercase.set(key, entry);
    }
    const n = row._count._all;
    entry.count += n;
    entry[fromDbStatus(row.status)] += n;
    entry.sum += Number(row._sum?.price ?? 0);
  }
  return [...byLowercase.values()].sort(
    (a, b) => b.count - a.count || a.genre.localeCompare(b.genre, undefined, { sensitivity: "base" }),
  );
}

// The currency sign printed in the sentences. Keep it in step with CURRENCY ("USD") in frontend/src/lib/format.js:
// change both together. The API's number fields never carry a sign; only the sentence text does.
export const CURRENCY_SYMBOL = "$";

// A money amount for a sentence: two decimals, then the sign after a space ("364.48 $")
export function formatMoneyText(amount) {
  return `${Number(amount).toFixed(2)} ${CURRENCY_SYMBOL}`;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// ---------- sentences ----------

// subject: "you" (the /me endpoint) or "this user" (an admin looking at someone else)
export function summarySentence(subject, { totalBooks, totalValue, completionRate, topGenres }) {
  const me = subject === "you";
  if (totalBooks === 0) {
    return me
      ? "Your library is empty. Add a few books and your insights will appear here."
      : "This user has no books yet.";
  }
  const owner = me ? "You own" : "This user owns";
  const their = me ? "your" : "their";
  const top = topGenres[0] ? `, and ${topGenres[0].genre} is ${their} top genre` : "";
  return `${owner} ${plural(totalBooks, "book")} with a total value of ${formatMoneyText(totalValue)}. ${completionRate}% are completed${top}.`;
}

// Exactly three sentences about the whole platform
export function adminSentences({ totalBooks, completionRate, topGenre, priciestGenre, averageBooksPerUser, totalUsers, usersWithoutBooks }) {
  const first =
    totalBooks === 0
      ? "There are no books on the platform yet."
      : `Readers have completed ${completionRate}% of the books on the platform.`;

  let second = "There are no genres to compare yet.";
  if (topGenre) {
    second = `${topGenre.genre} is the most common genre (${percent(topGenre.count, totalBooks)}% of all books)`;
    second +=
      priciestGenre && priciestGenre.genre !== topGenre.genre
        ? `, and ${priciestGenre.genre} has the highest average price among the top genres (${formatMoneyText(priciestGenre.averagePrice)}).`
        : ".";
  }

  let third = "There are no users yet.";
  if (totalUsers > 0) {
    third = `Users own ${averageBooksPerUser} books on average, and `;
    third +=
      usersWithoutBooks > 0
        ? `${plural(usersWithoutBooks, "user")} ${usersWithoutBooks === 1 ? "has" : "have"} no books yet.`
        : "every user has at least one book.";
  }
  return [first, second, third];
}

// "Owned by 14 readers. Fantasy is your top genre."  (topGenresLower = the user's top 3, lowercase, best first)
export function recommendationReason(owners, genre, topGenresLower) {
  let reason = `Owned by ${plural(owners, "reader")}.`;
  const rank = topGenresLower.indexOf(genre.toLowerCase());
  if (rank === 0) reason += ` ${genre} is your top genre.`;
  else if (rank > 0) reason += ` ${genre} is one of your top genres.`;
  return reason;
}
