// Admin API: stats, user management and book management across all users.
// The router already ran authenticate + requireAdmin, so every handler here is admin-only.
import prisma from "../lib/prisma.js";
import { toDbStatus } from "../lib/bookStatus.js";
import {
  bookView,
  parse,
  isRecordNotFound,
  buildBookFilter,
  dedupeGenres,
  toMoney,
  statusCounts,
  topGenresFrom,
} from "../lib/bookHelpers.js";
import { dayKey, lastDays, fillDays } from "../lib/insightHelpers.js";
import { updateBookSchema, idParamSchema } from "../validation/book.schemas.js";
import {
  userListQuerySchema,
  updateUserSchema,
  adminBookListQuerySchema,
  userIdParamSchema,
} from "../validation/admin.schemas.js";

// ---------- helpers ----------

// Explicit field list: passwordHash can never be selected, so it can never be sent
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  _count: { select: { books: true } },
};

function userView({ _count, ...user }) {
  return { ...user, booksCount: _count.books };
}

// A book with its owner. The owner comes from an explicit select, never the whole user row.
const withOwner = { user: { select: { id: true, name: true, email: true } } };

function adminBookView({ user, ...book }) {
  return { ...bookView(book), owner: user };
}

const userNotFound = (res) => res.status(404).json({ error: "User not found" });
const bookNotFound = (res) => res.status(404).json({ error: "Book not found" });

// ---------- stats ----------

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_DAYS = 14;

export async function getStats(req, res) {
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS);
  const since48h = new Date(now - 2 * DAY_MS);
  // The chart shows the last 14 calendar days (UTC), today included. The start goes to SQL as an ISO text
  // cast to "timestamp", so the server's time zone cannot shift it.
  const today = dayKey(new Date(now));
  const chartStart = `${lastDays(today, CHART_DAYS)[0]}T00:00:00.000Z`;

  // Database aggregation only; one transaction so the numbers fit together
  const [
    users,
    admins,
    books,
    value,
    byStatus,
    byGenre,
    recentUsers,
    adminList,
    newUsers7d,
    newBooks7d,
    perDay,
    recentBooks,
    usersWithoutBooks,
    newUsersLast48h,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.book.count(),
    prisma.book.aggregate({ _sum: { price: true } }),
    prisma.book.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.book.groupBy({ by: ["genre"], _count: { _all: true }, orderBy: { genre: "asc" } }),
    prisma.user.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5, select: userSelect }),
    prisma.user.findMany({
      where: { role: "admin" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.book.count({ where: { createdAt: { gte: since7d } } }),
    // Books created per calendar day (the only grouping by day: a fixed query with one parameter)
    prisma.$queryRaw`
      SELECT "createdAt"::date::text AS day, count(*)::int AS count
      FROM books
      WHERE "createdAt" >= ${chartStart}::timestamp
      GROUP BY 1`,
    prisma.book.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        author: true,
        genre: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where: { books: { none: {} } } }),
    prisma.user.count({ where: { createdAt: { gte: since48h } } }),
  ]);

  res.json({
    totals: { users, admins, books },
    libraryValue: toMoney(value._sum.price),
    booksByStatus: statusCounts(byStatus),
    topGenres: topGenresFrom(byGenre),
    recentUsers: recentUsers.map(userView),
    admins: adminList,
    newUsers7d,
    newBooks7d,
    booksPerDay: fillDays(perDay, CHART_DAYS, today),
    recentBooks: recentBooks.map(({ user, ...book }) => ({ ...book, owner: user })),
    attention: { usersWithoutBooks, newUsersLast48h },
  });
}

// ---------- users ----------

export async function listUsers(req, res) {
  const query = parse(userListQuerySchema, req.query, res);
  if (!query) return;

  const where = {};
  if (query.role) where.role = query.role;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }

  // "books" sorts by the number of books; id is a tie-breaker so pages stay stable
  const primary = query.sort === "books" ? { books: { _count: query.order } } : { [query.sort]: query.order };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [primary, { id: query.order }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: userSelect,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users: users.map(userView), page: query.page, limit: query.limit, total });
}

export async function updateUserRole(req, res) {
  const id = parse(userIdParamSchema, req.params.id, res);
  if (id === null) return;
  const data = parse(updateUserSchema, req.body, res);
  if (!data) return;

  // Admins cannot demote themselves, so at least one admin always remains
  if (id === req.user.id) return res.status(403).json({ error: "You cannot change your own role" });

  try {
    const user = await prisma.user.update({ where: { id }, data: { role: data.role }, select: userSelect });
    res.json(userView(user));
  } catch (err) {
    if (isRecordNotFound(err)) return userNotFound(res);
    throw err;
  }
}

export async function deleteUser(req, res) {
  const id = parse(userIdParamSchema, req.params.id, res);
  if (id === null) return;

  if (id === req.user.id) return res.status(403).json({ error: "You cannot delete your own account" });

  try {
    // The user's books are removed by the onDelete: Cascade relation
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isRecordNotFound(err)) return userNotFound(res);
    throw err;
  }
}

// ---------- books (all users) ----------

export async function listAdminBooks(req, res) {
  const query = parse(adminBookListQuerySchema, req.query, res);
  if (!query) return;

  const where = buildBookFilter(query);
  if (query.userId) where.userId = query.userId;

  const [books, total] = await prisma.$transaction([
    prisma.book.findMany({
      where,
      include: withOwner,
      orderBy: [{ [query.sort]: query.order }, { id: query.order }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.book.count({ where }),
  ]);

  res.json({ books: books.map(adminBookView), page: query.page, limit: query.limit, total });
}

export async function getAdminBook(req, res) {
  const id = parse(idParamSchema, req.params.id, res);
  if (id === null) return;

  const book = await prisma.book.findUnique({ where: { id }, include: withOwner });
  if (!book) return bookNotFound(res);

  res.json(adminBookView(book));
}

export async function updateAdminBook(req, res) {
  const id = parse(idParamSchema, req.params.id, res);
  if (id === null) return;
  // updateBookSchema strips userId, so the owner can never change
  const data = parse(updateBookSchema, req.body, res);
  if (!data) return;

  try {
    const book = await prisma.book.update({
      where: { id },
      data: { ...data, status: toDbStatus(data.status) },
      include: withOwner,
    });
    res.json(adminBookView(book));
  } catch (err) {
    if (isRecordNotFound(err)) return bookNotFound(res);
    throw err;
  }
}

export async function deleteAdminBook(req, res) {
  const id = parse(idParamSchema, req.params.id, res);
  if (id === null) return;

  try {
    await prisma.book.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isRecordNotFound(err)) return bookNotFound(res);
    throw err;
  }
}

// All genres of all users, case variants merged, sorted A-Z (for the admin filter)
export async function listAllGenres(req, res) {
  const rows = await prisma.book.findMany({ distinct: ["genre"], select: { genre: true } });
  res.json({ genres: dedupeGenres(rows) });
}
