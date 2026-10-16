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
