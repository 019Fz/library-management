// Database queries shared by the insights endpoints. Numbers come from database aggregation.
// Raw SQL uses tagged templates (values are parameters). Table and column names are the real ones
// from prisma/schema.prisma: tables "books" and "users", columns "userId", "createdAt", title, author, ...
import prisma from "./prisma.js";
import { statusCounts, topCounts, toMoney } from "./bookHelpers.js";
import { percent, summarySentence, recommendationReason } from "./insightHelpers.js";

// The insights of one user's library. subject = "you" (own data) or "this user" (an admin looking).
export async function userInsights(userId, subject) {
  const where = { userId };
  const [totals, byStatus, byGenre] = await prisma.$transaction([
    prisma.book.aggregate({ where, _count: { _all: true }, _sum: { price: true }, _avg: { price: true }, _max: { price: true } }),
    prisma.book.groupBy({ by: ["status"], where, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.book.groupBy({ by: ["genre"], where, _count: { _all: true }, orderBy: { genre: "asc" } }),
  ]);

  const totalBooks = totals._count._all;
  const counts = statusCounts(byStatus);
  const result = {
    totalBooks,
    totalValue: toMoney(totals._sum.price),
    averagePrice: toMoney(totals._avg.price),
    mostExpensive: totals._max.price ? Number(totals._max.price) : null,
    completionRate: percent(counts.completed, totalBooks),
    statusCounts: counts,
    topGenres: topCounts(byGenre, "genre", 5),
  };
  return { ...result, summary: summarySentence(subject, result) };
}

// Titles ranked by the number of different users who own them (title compared ignoring case)
export async function popularTitles(limit) {
  const rows = await prisma.$queryRaw`
    SELECT min(title COLLATE "C") AS title, count(DISTINCT "userId")::int AS owners
    FROM books
    GROUP BY lower(title)
    ORDER BY owners DESC, lower(title) ASC
    LIMIT ${limit}::int`;
  return rows.map((row) => ({ title: row.title, owners: Number(row.owners) }));
}

const MAX_RECOMMENDATIONS = 6;

// Up to 6 books the user does not own (titles compared ignoring case), owned by other users.
// Books in the user's top 3 genres come first, then more owners first. Only title, author, genre,
// price and the number of owners are selected: never a name, email or id.
export async function recommendationsFor(userId) {
  const genreRows = await prisma.book.groupBy({ by: ["genre"], where: { userId }, _count: { _all: true }, orderBy: { genre: "asc" } });
  const topGenres = topCounts(genreRows, "genre", 3).map((row) => row.genre.toLowerCase());
  // Passed as one JSON text parameter, so an empty list (a user with no books) is just "[]"
  const genresJson = JSON.stringify(topGenres);

  const rows = await prisma.$queryRaw`
    WITH other AS (
      SELECT id, title, author, genre, price, "userId" FROM books
      WHERE "userId" <> ${userId}
        AND lower(title) NOT IN (SELECT lower(title) FROM books WHERE "userId" = ${userId})
    ),
    shared AS (
      SELECT lower(title) AS key, count(DISTINCT "userId")::int AS owners FROM other GROUP BY 1
    ),
    pick AS (
      SELECT DISTINCT ON (lower(title)) lower(title) AS key, title, author, genre, price
      FROM other ORDER BY lower(title), id
    )
    SELECT p.title, p.author, p.genre, p.price::float8 AS price, s.owners
    FROM pick p JOIN shared s ON s.key = p.key
    ORDER BY (lower(p.genre) IN (SELECT jsonb_array_elements_text(${genresJson}::jsonb))) DESC, s.owners DESC, p.key ASC
    LIMIT ${MAX_RECOMMENDATIONS}::int`;

  return rows.map((row) => ({
    title: row.title,
    author: row.author,
    genre: row.genre,
    price: Number(row.price),
    owners: Number(row.owners),
    reason: recommendationReason(Number(row.owners), row.genre, topGenres),
  }));
}
