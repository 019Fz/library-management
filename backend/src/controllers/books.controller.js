// Book CRUD. Every query includes userId so users only ever touch their own books.
import prisma from "../lib/prisma.js";
import { toDbStatus, fromDbStatus } from "../lib/bookStatus.js";
import {
  createBookSchema,
  updateBookSchema,
  listQuerySchema,
  idParamSchema,
} from "../validation/book.schemas.js";

// Shape sent to the client: API status name, price as a number
function bookView(book) {
  return { ...book, status: fromDbStatus(book.status), price: Number(book.price) };
}

// Validate data with a schema. On failure sends a 400 and returns null.
function parse(schema, data, res) {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", details: result.error.issues });
    return null;
  }
  return result.data;
}

// Missing book and someone else's book look the same on purpose
function sendNotFound(res) {
  return res.status(404).json({ error: "Book not found" });
}

// P2025 = Prisma found no record matching the where clause (id + userId)
function isRecordNotFound(err) {
  return err.code === "P2025";
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

  const where = { userId: req.user.id };
  if (query.genre) where.genre = { equals: query.genre, mode: "insensitive" };
  if (query.status) where.status = toDbStatus(query.status);
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { author: { contains: query.q, mode: "insensitive" } },
    ];
  }

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
