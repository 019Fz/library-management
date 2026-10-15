// Integration tests for /api/books. They use the real database (the Postgres container must be running).
// Every test user is new, so the seeded admin and its books are never touched.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";

// Unique emails per run; we remember them so we only delete what the tests created
const runId = Date.now();
const createdEmails = [];
let counter = 0;

// Helper: register a fresh user and return { id, token }
async function newUser() {
  const email = `auth-test-books-${runId}-${counter++}@example.test`;
  createdEmails.push(email);
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Book Tester", email, password: "password123" });
  return { id: res.body.user.id, token: res.body.token };
}

// Helpers for authenticated requests
const post = (user, body) => request(app).post("/api/books").set("Authorization", `Bearer ${user.token}`).send(body);
const get = (user, path = "") => request(app).get(`/api/books${path}`).set("Authorization", `Bearer ${user.token}`);
const patch = (user, id, body) => request(app).patch(`/api/books/${id}`).set("Authorization", `Bearer ${user.token}`).send(body);
const del = (user, id) => request(app).delete(`/api/books/${id}`).set("Authorization", `Bearer ${user.token}`);

const validBook = { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", price: 12.99, status: "completed" };

// Deleting the users also deletes their books (cascade)
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("auth required", () => {
  it("returns 401 on every route without a token", async () => {
    const responses = await Promise.all([
      request(app).post("/api/books").send(validBook),
      request(app).get("/api/books"),
      request(app).get("/api/books/1"),
      request(app).patch("/api/books/1").send({ title: "x" }),
      request(app).delete("/api/books/1"),
    ]);
    for (const res of responses) expect(res.status).toBe(401);
  });
});

describe("POST /api/books", () => {
  let user;
  beforeAll(async () => {
    user = await newUser();
  });

  it("creates a book owned by the caller", async () => {
    const res = await post(user, validBook);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", status: "completed" });
    expect(res.body.userId).toBe(user.id);
    expect(res.body.price).toBe(12.99); // a number, not a string
  });

  it("defaults the status to to-read", async () => {
    const { status, ...withoutStatus } = validBook;
    const res = await post(user, withoutStatus);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("to-read");
  });

  it("trims text fields", async () => {
    const res = await post(user, { ...validBook, title: "  Padded  " });
    expect(res.body.title).toBe("Padded");
  });

  it("ignores a userId sent in the body", async () => {
    const other = await newUser();
    const res = await post(user, { ...validBook, userId: other.id });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(user.id);
  });

  it("accepts valid prices: 0, 19.99, 0.07 and the maximum", async () => {
    for (const price of [0, 19.99, 0.07, 99999999.99]) {
      const res = await post(user, { ...validBook, price });
      expect(res.status, `price ${price}`).toBe(201);
      expect(res.body.price).toBe(price);
    }
  });

  it("rejects invalid prices: 10.999, 1.005, negative, too large, string", async () => {
    for (const price of [10.999, 1.005, -1, 100000000, "12.99"]) {
      const res = await post(user, { ...validBook, price });
      expect(res.status, `price ${JSON.stringify(price)}`).toBe(400);
    }
  });

  it("rejects missing, blank and too-long fields", async () => {
    const bad = [
      { ...validBook, title: undefined },
      { ...validBook, title: "   " },
      { ...validBook, title: "x".repeat(201) },
      { ...validBook, author: "x".repeat(151) },
      { ...validBook, genre: "x".repeat(51) },
      { ...validBook, price: undefined },
    ];
    for (const body of bad) {
      const res = await post(user, body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });

  it("rejects an invalid status", async () => {
    const res = await post(user, { ...validBook, status: "to_read" }); // the enum name is not an API value
    expect(res.status).toBe(400);
  });

  it("returns 400 when there is no body", async () => {
    const res = await request(app).post("/api/books").set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/books (list)", () => {
  let user;
  let other;

  beforeAll(async () => {
    user = await newUser();
    other = await newUser();

    // Created one by one so createdAt order is the creation order
    const books = [
      { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", price: 12.99, status: "completed" },
      { title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fantasy", price: 9.5, status: "reading" },
      { title: "Clean Code", author: "Robert Martin", genre: "Programming", price: 34 },
      { title: "Dune Messiah", author: "Frank Herbert", genre: "Sci-Fi", price: 10.25 },
      { title: "Neuromancer", author: "William Gibson", genre: "sci-fi", price: 7, status: "reading" },
    ];
    for (const book of books) await post(user, book);

    // Another user's books must never show up for `user`
    await post(other, { title: "Dune Secret", author: "Someone Else", genre: "Sci-Fi", price: 1 });
  });

  const titles = (res) => res.body.books.map((b) => b.title);

  it("returns only the caller's books, newest first by default", async () => {
    const res = await get(user);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 5 });
    expect(titles(res)).toEqual(["Neuromancer", "Dune Messiah", "Clean Code", "The Hobbit", "Dune"]);
    expect(res.body.books.every((b) => b.userId === user.id)).toBe(true);
    expect(typeof res.body.books[0].price).toBe("number");
  });

  it("filters by genre, ignoring case", async () => {
    const res = await get(user, "?genre=SCI-FI");
    expect(res.body.total).toBe(3);
    expect(titles(res).sort()).toEqual(["Dune", "Dune Messiah", "Neuromancer"]);
  });

  it("filters by status (to-read is the API name)", async () => {
    expect((await get(user, "?status=reading")).body.total).toBe(2);
    expect((await get(user, "?status=completed")).body.total).toBe(1);
    const toRead = await get(user, "?status=to-read");
    expect(titles(toRead).sort()).toEqual(["Clean Code", "Dune Messiah"]);
    expect(toRead.body.books.every((b) => b.status === "to-read")).toBe(true);
  });

  it("searches title and author with q, ignoring case", async () => {
    expect(titles(await get(user, "?q=dune")).sort()).toEqual(["Dune", "Dune Messiah"]);
    expect(titles(await get(user, "?q=GIBSON"))).toEqual(["Neuromancer"]);
  });

  it("combines filters", async () => {
    const res = await get(user, "?genre=sci-fi&status=to-read&q=dune");
    expect(titles(res)).toEqual(["Dune Messiah"]);
  });

  it("ignores empty filter values", async () => {
    const res = await get(user, "?genre=&q=");
    expect(res.body.total).toBe(5);
  });

  it("sorts by price and title in both directions", async () => {
    const priceAsc = await get(user, "?sort=price&order=asc");
    expect(priceAsc.body.books.map((b) => b.price)).toEqual([7, 9.5, 10.25, 12.99, 34]);

    const priceDesc = await get(user, "?sort=price&order=desc");
    expect(priceDesc.body.books.map((b) => b.price)).toEqual([34, 12.99, 10.25, 9.5, 7]);

    const titleAsc = await get(user, "?sort=title&order=asc");
    expect(titles(titleAsc)).toEqual(["Clean Code", "Dune", "Dune Messiah", "Neuromancer", "The Hobbit"]);
  });

  it("paginates and reports the total", async () => {
    const page1 = await get(user, "?limit=2&page=1&sort=price&order=asc");
    const page2 = await get(user, "?limit=2&page=2&sort=price&order=asc");
    const page3 = await get(user, "?limit=2&page=3&sort=price&order=asc");
    const page4 = await get(user, "?limit=2&page=4&sort=price&order=asc");

    expect(page1.body).toMatchObject({ page: 1, limit: 2, total: 5 });
    expect(page1.body.books.map((b) => b.price)).toEqual([7, 9.5]);
    expect(page2.body.books.map((b) => b.price)).toEqual([10.25, 12.99]);
    expect(page3.body.books.map((b) => b.price)).toEqual([34]);
    expect(page4.body.books).toEqual([]);
    expect(page4.body.total).toBe(5);
  });

  it("returns 400 for invalid query values", async () => {
    for (const query of ["?limit=51", "?limit=0", "?page=0", "?page=abc", "?sort=author", "?order=up", "?status=to_read"]) {
      const res = await get(user, query);
      expect(res.status, query).toBe(400);
    }
  });

  // Known behaviour, not fixed on purpose: Prisma "contains" does not escape % and _,
  // so they act as SQL wildcards in q. Results are still limited to the caller's books.
  it("treats % in q as a wildcard (known behaviour)", async () => {
    const res = await get(user, "?q=%25");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
  });
});

describe("GET, PATCH and DELETE /api/books/:id", () => {
  let owner;
  let stranger;
  let book;

  beforeAll(async () => {
    owner = await newUser();
    stranger = await newUser();
    book = (await post(owner, validBook)).body;
  });

  it("gets one book", async () => {
    const res = await get(owner, `/${book.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: book.id, title: "Dune", price: 12.99, status: "completed" });
  });

  it("updates some fields and keeps the rest", async () => {
    const res = await patch(owner, book.id, { price: 15.5, status: "to-read" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Dune", price: 15.5, status: "to-read", userId: owner.id });
  });

  it("cannot change the owner", async () => {
    const res = await patch(owner, book.id, { title: "Dune (2nd ed.)", userId: stranger.id });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(owner.id);
    expect(res.body.title).toBe("Dune (2nd ed.)");
  });

  it("rejects an update with no usable fields", async () => {
    expect((await patch(owner, book.id, {})).status).toBe(400);
    expect((await patch(owner, book.id, { userId: stranger.id })).status).toBe(400);
  });

  it("rejects invalid values on update", async () => {
    expect((await patch(owner, book.id, { price: 1.005 })).status).toBe(400);
    expect((await patch(owner, book.id, { title: "" })).status).toBe(400);
    expect((await patch(owner, book.id, { status: "finished" })).status).toBe(400);
  });

  it("returns 400 for an invalid id", async () => {
    for (const id of ["abc", "0", "-1", "1.5", "99999999999"]) {
      expect((await get(owner, `/${id}`)).status, `GET ${id}`).toBe(400);
      expect((await patch(owner, id, { title: "x" })).status, `PATCH ${id}`).toBe(400);
      expect((await del(owner, id)).status, `DELETE ${id}`).toBe(400);
    }
  });

  it("returns 404 'Book not found' for an id that does not exist", async () => {
    const res = await get(owner, "/2147483647");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Book not found");
  });

  it("hides another user's book: GET, PATCH and DELETE all return the same 404", async () => {
    const missing = await get(owner, "/2147483647");

    const getRes = await get(stranger, `/${book.id}`);
    const patchRes = await patch(stranger, book.id, { title: "Hacked" });
    const delRes = await del(stranger, book.id);

    for (const res of [getRes, patchRes, delRes]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(missing.body);
    }

    // The book is unchanged
    const after = await get(owner, `/${book.id}`);
    expect(after.status).toBe(200);
    expect(after.body.title).toBe("Dune (2nd ed.)");
  });

  it("deletes a book: 204, then 404", async () => {
    const res = await del(owner, book.id);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    expect((await get(owner, `/${book.id}`)).status).toBe(404);
    expect((await del(owner, book.id)).status).toBe(404);
  });
});

describe("GET /api/books/genres", () => {
  let user;
  let other;

  beforeAll(async () => {
    user = await newUser();
    other = await newUser();

    for (const genre of ["sci-fi", "Sci-Fi", "Fantasy", "programming", "Fantasy"]) {
      await post(user, { ...validBook, genre });
    }
    await post(other, { ...validBook, genre: "Secret Genre" });
  });

  it("returns the caller's genres, sorted A-Z, with case-insensitive duplicates collapsed", async () => {
    const res = await get(user, "/genres");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ genres: ["Fantasy", "programming", "Sci-Fi"] });
  });

  it("never includes another user's genres", async () => {
    const mine = await get(user, "/genres");
    const theirs = await get(other, "/genres");

    expect(mine.body.genres).not.toContain("Secret Genre");
    expect(theirs.body.genres).toEqual(["Secret Genre"]);
  });

  it("returns an empty list for a user without books", async () => {
    const empty = await newUser();
    const res = await get(empty, "/genres");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ genres: [] });
  });

  it("is not treated as a book id", async () => {
    const res = await get(user, "/genres");

    expect(res.status).toBe(200); // an id route would answer 400 "Book id must be a positive integer"
    expect(Array.isArray(res.body.genres)).toBe(true);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/books/genres");
    expect(res.status).toBe(401);
  });
});
