// Helpers shared by the user books controller and the admin controller.
import { toDbStatus, fromDbStatus } from "./bookStatus.js";

// Shape sent to the client: API status name, price as a number
export function bookView(book) {
  return { ...book, status: fromDbStatus(book.status), price: Number(book.price) };
}

// Validate data with a schema. On failure sends a 400 and returns null.
export function parse(schema, data, res) {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", details: result.error.issues });
    return null;
  }
  return result.data;
}

// P2025 = Prisma found no record matching the where clause
export function isRecordNotFound(err) {
  return err.code === "P2025";
}

// Prisma "where" for the filters shared by both book lists: genre, status and q
export function buildBookFilter(query) {
  const where = {};
  if (query.genre) where.genre = { equals: query.genre, mode: "insensitive" };
  if (query.status) where.status = toDbStatus(query.status);
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { author: { contains: query.q, mode: "insensitive" } },
    ];
  }
  return where;
}

// Prisma sums are Decimals (or null when there are no rows) -> number with 2 decimals
export function toMoney(sum) {
  return sum ? Number(sum.toFixed(2)) : 0;
}

// groupBy rows -> { reading, completed, "to-read" }, with 0 for a status that has no books
export function statusCounts(rows) {
  const counts = { reading: 0, completed: 0, "to-read": 0 };
  for (const row of rows) counts[fromDbStatus(row.status)] = row._count._all;
  return counts;
}

// groupBy rows (one per exact spelling of `field`) -> [{ [field]: name, count }] biggest first,
// with spellings that differ only by case counted together (Sci-Fi and sci-fi).
// The capitalised spelling is kept (code-point order puts it first, as in dedupeGenres).
export function topCounts(rows, field, limit = 5) {
  const sorted = [...rows].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0));
  const byLowercase = new Map();
  for (const row of sorted) {
    const key = row[field].toLowerCase();
    const entry = byLowercase.get(key);
    if (entry) entry.count += row._count._all;
    else byLowercase.set(key, { [field]: row[field], count: row._count._all });
  }
  return [...byLowercase.values()]
    .sort((a, b) => b.count - a.count || a[field].localeCompare(b[field], undefined, { sensitivity: "base" }))
    .slice(0, limit);
}

// The same for genres
export function topGenresFrom(rows, limit = 5) {
  return topCounts(rows, "genre", limit);
}

// Rows like { genre } -> genre names where spellings that differ only by case are collapsed, sorted A-Z
export function dedupeGenres(rows) {
  // Code-point order puts "Sci-Fi" before "sci-fi", so the capitalised spelling is the one kept
  const spellings = rows.map((row) => row.genre).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const byLowercase = new Map();
  for (const genre of spellings) {
    const key = genre.toLowerCase();
    if (!byLowercase.has(key)) byLowercase.set(key, genre);
  }

  return [...byLowercase.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
