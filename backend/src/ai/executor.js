// Runs an intent with a fixed, parameterised Prisma query. Question text never reaches a query as SQL:
// only validated parameter values do, as bound values.
// Scoping is decided HERE from the logged-in user, never from the parameters: a normal user always
// gets userId = user.id. Admins may look at everyone's books, only their own, or one owner's.
import prisma from "../lib/prisma.js";
import { buildBookFilter, statusCounts, topCounts, toMoney } from "../lib/bookHelpers.js";
import { fromDbStatus } from "../lib/bookStatus.js";
import { popularTitles } from "../lib/insightQueries.js";
import { isAdminOnly } from "./intents.js";

// Which books may this caller see? Returns the Prisma "where" part and whether owner names are shown.
function bookScope(params, user) {
  if (user.role !== "admin") return { where: { userId: user.id }, showOwner: false };
  if (params.ownerName) {
    return {
      where: { user: { is: { name: { contains: params.ownerName, mode: "insensitive" } } } },
      showOwner: true,
    };
  }
  if (params.scope === "mine") return { where: { userId: user.id }, showOwner: false };
  return { where: {}, showOwner: true };
}

// Scope plus the filters of the question
function bookWhere(params, user) {
  const { where: scopeWhere, showOwner } = bookScope(params, user);
  const where = { ...buildBookFilter({ genre: params.genre, status: params.status }), ...scopeWhere };
  if (params.author) where.author = { contains: params.author, mode: "insensitive" };
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.price = {};
    if (params.minPrice !== undefined) where.price.gte = params.minPrice;
    if (params.maxPrice !== undefined) where.price.lte = params.maxPrice;
  }
  return { where, showOwner };
}

// For the intents that only need "whose books": the caller's own, or (admins) everyone's
function simpleScope(params, user) {
  return user.role !== "admin" || params.scope === "mine" ? { userId: user.id } : {};
}

// Decimal (or null) -> number with 2 decimals, null stays null
const money = (value) => (value === null ? null : Number(value.toFixed(2)));

const handlers = {
  async list_books(params, user) {
    const { where, showOwner } = bookWhere(params, user);
    const [books, total] = await prisma.$transaction([
      prisma.book.findMany({
        where,
        orderBy: [{ [params.sort]: params.order }, { id: params.order }],
        take: params.limit,
        // Explicit fields: the owner's name is only fetched for admins looking at other users' books
        select: {
          id: true,
          title: true,
          author: true,
          genre: true,
          status: true,
          price: true,
          ...(showOwner ? { user: { select: { name: true } } } : {}),
        },
      }),
      prisma.book.count({ where }),
    ]);

    return {
      total,
      showOwner,
      books: books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        status: fromDbStatus(book.status),
        price: Number(book.price),
        ...(showOwner ? { owner: book.user.name } : {}),
      })),
    };
  },

  async book_stats(params, user) {
    const { where } = bookWhere(params, user);
    const stats = await prisma.book.aggregate({
      where,
      _count: { _all: true },
      _sum: { price: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    });

    const count = stats._count._all;
    const values = {
      count,
      sum_price: toMoney(stats._sum.price),
      avg_price: money(stats._avg.price),
      min_price: money(stats._min.price),
      max_price: money(stats._max.price),
    };
    return { metric: params.metric, value: values[params.metric], count };
  },

  async top_genres(params, user) {
    const rows = await prisma.book.groupBy({
      by: ["genre"],
      where: simpleScope(params, user),
      _count: { _all: true },
      orderBy: { genre: "asc" },
    });
    return { items: topCounts(rows, "genre", params.limit) };
  },

  async top_authors(params, user) {
    const rows = await prisma.book.groupBy({
      by: ["author"],
      where: simpleScope(params, user),
      _count: { _all: true },
      orderBy: { author: "asc" },
    });
    return { items: topCounts(rows, "author", params.limit) };
  },

  async status_breakdown(params, user) {
    const rows = await prisma.book.groupBy({
      by: ["status"],
      where: simpleScope(params, user),
      _count: { _all: true },
      orderBy: { status: "asc" },
    });
    const counts = statusCounts(rows);
    return { counts, total: counts.reading + counts.completed + counts["to-read"] };
  },

  // Admin only: users ranked by number of books (users without books are left out)
  async top_owners(params) {
    const users = await prisma.user.findMany({
      where: { books: { some: {} } },
      orderBy: [{ books: { _count: "desc" } }, { name: "asc" }, { id: "asc" }],
      take: params.limit,
      select: { name: true, email: true, _count: { select: { books: true } } },
    });
    return { owners: users.map((user) => ({ name: user.name, email: user.email, books: user._count.books })) };
  },

  // Admin only: titles ranked by the number of DIFFERENT users who own a book with that title, ignoring case.
  // One fixed query (a tagged template, so the limit is a bound value). It is raw SQL only because
  // "distinct users per case-insensitive title" cannot be written with groupBy.
  async popular_books(params) {
    // The query lives in lib/insightQueries.js (the admin insights use it too)
    return { books: await popularTitles(params.limit) };
  },

  async count_users() {
    const [users, admins] = await prisma.$transaction([prisma.user.count(), prisma.user.count({ where: { role: "admin" } })]);
    return { users, admins };
  },
};

// name = an intent name, params = already validated, user = req.user (from the token)
export async function runIntent(name, params, user) {
  if (isAdminOnly(name) && user.role !== "admin") throw new Error("Admin-only intent run for a normal user");
  if (!Object.hasOwn(handlers, name)) throw new Error("Unknown intent");
  return handlers[name](params, user);
}
