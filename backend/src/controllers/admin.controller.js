// Admin API: stats, user management and book management across all users.
// The router already ran authenticate + requireAdmin, so every handler here is admin-only.
import prisma from "../lib/prisma.js";
import { fromDbStatus, toDbStatus } from "../lib/bookStatus.js";
import { bookView, parse, isRecordNotFound, buildBookFilter, dedupeGenres } from "../lib/bookHelpers.js";
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

// groupBy rows (one per exact spelling) -> top genres with Sci-Fi and sci-fi counted together.
// The capitalised spelling is kept (code-point order puts it first, as in dedupeGenres).
export function topGenresFrom(rows, limit = 5) {
  const sorted = [...rows].sort((a, b) => (a.genre < b.genre ? -1 : a.genre > b.genre ? 1 : 0));
  const byLowercase = new Map();
  for (const row of sorted) {
    const key = row.genre.toLowerCase();
    const entry = byLowercase.get(key);
    if (entry) entry.count += row._count._all;
    else byLowercase.set(key, { genre: row.genre, count: row._count._all });
  }
  return [...byLowercase.values()]
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre, undefined, { sensitivity: "base" }))
    .slice(0, limit);
}

// ---------- stats ----------

export async function getStats(req, res) {
  // Database aggregation only; one transaction so the numbers fit together
  const [users, admins, books, value, byStatus, byGenre, recentUsers, adminList] = await prisma.$transaction([
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
  ]);

  res.json({
    totals: { users, admins, books },
    libraryValue: toMoney(value._sum.price),
    booksByStatus: statusCounts(byStatus),
    topGenres: topGenresFrom(byGenre),
    recentUsers: recentUsers.map(userView),
    admins: adminList,
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
