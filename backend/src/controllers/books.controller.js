// Book CRUD. Every query includes userId so users only ever touch their own books.
import prisma from "../lib/prisma.js";
import { toDbStatus } from "../lib/bookStatus.js";
import { bookView, parse, isRecordNotFound, buildBookFilter, dedupeGenres } from "../lib/bookHelpers.js";
import {
  createBookSchema,
  updateBookSchema,
  listQuerySchema,
  idParamSchema,
} from "../validation/book.schemas.js";

// Missing book and someone else's book look the same on purpose
function sendNotFound(res) {
  return res.status(404).json({ error: "Book not found" });
}

export async function createBook(req, res) {
  const data = parse(createBookSchema, req.body, res);
  if (!data) return;

  // The owner always comes from the token
  const book = await prisma.book.create({
    data: { ...data, status: toDbStatus(data.status), userId: req.user.id },
  });
  res.status(201).json(bookView(book));
}

export async function listBooks(req, res) {
  // req.query is read-only in Express 5, so we only read the parsed copy
  const query = parse(listQuerySchema, req.query, res);
  if (!query) return;

  // userId in the where clause keeps the list to the caller's own books
  const where = { ...buildBookFilter(query), userId: req.user.id };

  // id is a tie-breaker so pages stay stable when sort values are equal
  const [books, total] = await prisma.$transaction([
    prisma.book.findMany({
      where,
      orderBy: [{ [query.sort]: query.order }, { id: query.order }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.book.count({ where }),
  ]);

  res.json({ books: books.map(bookView), page: query.page, limit: query.limit, total });
}

// The caller's genres: duplicates that differ only by case are collapsed, sorted A-Z
export async function listGenres(req, res) {
  const rows = await prisma.book.findMany({
    where: { userId: req.user.id },
    distinct: ["genre"],
    select: { genre: true },
  });

  res.json({ genres: dedupeGenres(rows) });
}

export async function getBook(req, res) {
  const id = parse(idParamSchema, req.params.id, res);
  if (id === null) return;

  const book = await prisma.book.findFirst({ where: { id, userId: req.user.id } });
  if (!book) return sendNotFound(res);

  res.json(bookView(book));
}

export async function updateBook(req, res) {
  const id = parse(idParamSchema, req.params.id, res);
  if (id === null) return;
  const data = parse(updateBookSchema, req.body, res);
  if (!data) return;

  try {
    // userId in the where clause is the ownership check; userId is never in data
    const book = await prisma.book.update({
      where: { id, userId: req.user.id },
      data: { ...data, status: toDbStatus(data.status) },
    });
    res.json(bookView(book));
  } catch (err) {
    if (isRecordNotFound(err)) return sendNotFound(res);
    throw err;
  }
}

export async function deleteBook(req, res) {
  const id = parse(idParamSchema, req.params.id, res);
  if (id === null) return;

  try {
    await prisma.book.delete({ where: { id, userId: req.user.id } });
    res.status(204).end();
  } catch (err) {
    if (isRecordNotFound(err)) return sendNotFound(res);
    throw err;
  }
}
