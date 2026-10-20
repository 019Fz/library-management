// Admin insights: patterns across all users. The router already ran authenticate + requireAdmin.
// Only grouped numbers are loaded (counts, sums), never book rows. No passwordHash or email is selected.
import prisma from "../lib/prisma.js";
import { parse } from "../lib/bookHelpers.js";
import { userIdParamSchema } from "../validation/admin.schemas.js";
import { userInsights, popularTitles } from "../lib/insightQueries.js";
import { PRICE_BUCKETS, adminSentences, mergeGenres, percent, round2 } from "../lib/insightHelpers.js";

const TOP_GENRES = 5;

// Prisma "where" for one price bucket (gte <= price < lt)
function bucketWhere(bucket) {
  const price = {};
  if (bucket.gte !== undefined) price.gte = bucket.gte;
  if (bucket.lt !== undefined) price.lt = bucket.lt;
  return { price };
}

export async function getAdminInsights(req, res) {
  // Counts and one grouped query, in one transaction so the numbers fit together
  const [users, books, usersWithoutBooks, completed, grouped, ...bucketCounts] = await prisma.$transaction([
    prisma.user.count(),
    prisma.book.count(),
    prisma.user.count({ where: { books: { none: {} } } }),
    prisma.book.count({ where: { status: "completed" } }),
    prisma.book.groupBy({
      by: ["genre", "status"],
      _count: { _all: true },
      _sum: { price: true },
      orderBy: [{ genre: "asc" }, { status: "asc" }],
    }),
    ...PRICE_BUCKETS.map((bucket) => prisma.book.count({ where: bucketWhere(bucket) })),
  ]);

  // Users with at least 5 books, best completion rate first (id and name only: no email, no hash)
  const [completionRows, popular] = await Promise.all([
    prisma.$queryRaw`
      SELECT u.id, u.name, count(*)::int AS books,
             (count(*) FILTER (WHERE b.status = 'completed'))::int AS completed
      FROM books b JOIN users u ON u.id = b."userId"
      GROUP BY u.id, u.name
      HAVING count(*) >= 5
      ORDER BY (count(*) FILTER (WHERE b.status = 'completed'))::float / count(*) DESC, count(*) DESC, u.id ASC
      LIMIT 10`,
    popularTitles(5),
  ]);

  // Genres from the grouped numbers (case variants merged); the same top 5 feed three blocks
  const top = mergeGenres(grouped).slice(0, TOP_GENRES);
  const averagePriceByGenre = top.map((g) => ({
    genre: g.genre,
    averagePrice: g.count > 0 ? round2(g.sum / g.count) : 0,
    count: g.count,
  }));
  const priciest = averagePriceByGenre.reduce((best, g) => (!best || g.averagePrice > best.averagePrice ? g : best), null);

  const completionRate = percent(completed, books);
  const averageBooksPerUser = users > 0 ? Number((books / users).toFixed(1)) : 0;

  res.json({
    averageBooksPerUser,
    usersWithoutBooks,
    completionRate,
    topGenres: top.map((g) => ({ genre: g.genre, count: g.count })),
    statusByGenre: top.map((g) => ({
      genre: g.genre,
      reading: g.reading,
      completed: g.completed,
      "to-read": g["to-read"],
    })),
    priceBuckets: PRICE_BUCKETS.map((bucket, i) => ({ label: bucket.label, count: bucketCounts[i] })),
    averagePriceByGenre,
    completionByUser: completionRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      books: Number(row.books),
      completed: Number(row.completed),
      completionRate: percent(Number(row.completed), Number(row.books)),
    })),
    popularTitles: popular,
    insights: adminSentences({
      totalBooks: books,
      completionRate,
      topGenre: top[0],
      priciestGenre: priciest,
      averageBooksPerUser,
      totalUsers: users,
      usersWithoutBooks,
    }),
  });
}

// The same insights as /api/insights/me, for any user (wording "this user")
export async function getUserInsights(req, res) {
  const id = parse(userIdParamSchema, req.params.id, res);
  if (id === null) return;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(await userInsights(id, "this user"));
}
