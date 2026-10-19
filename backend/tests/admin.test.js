// Integration tests for /api/admin. They use the real database (the Postgres container must be running).
// The dev database also holds demo data, so no test asserts absolute totals: numbers are compared with
// direct Prisma queries, or with data created here (found through a unique per-run text).
// Test users are new; the seeded admin and its password are never used.
import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { JWT_SECRET } from "../src/config.js";
import { toMoney, statusCounts, topGenresFrom } from "../src/lib/bookHelpers.js";

// Unique per run. The password is random for every run, never a fixed string.
const runId = Date.now();
const tag = `Zq${runId}`; // appears in the name of every user created here
const password = crypto.randomBytes(16).toString("hex");
const EMAIL_PREFIX = "auth-test-admin-";
const createdEmails = [];
let counter = 0;

// Zero-padded, so sorting by email gives the creation order
function nextEmail() {
  const email = `${EMAIL_PREFIX}${runId}-${String(counter++).padStart(3, "0")}@example.test`;
  createdEmails.push(email);
  return email;
}

// A normal user, registered through the API. Returns { id, token, name, email }.
async function newUser(label) {
  const name = `${tag} ${label}`;
  const email = nextEmail();
  const res = await request(app).post("/api/auth/register").send({ name, email, password });
  return { id: res.body.user.id, token: res.body.token, name, email };
}

// An admin: created directly with Prisma (register never makes admins), then logged in through the API
async function newAdmin(label) {
  const name = `${tag} ${label}`;
  const email = nextEmail();
  const passwordHash = await bcrypt.hash(password, 4);
  const created = await prisma.user.create({ data: { name, email, passwordHash, role: "admin" } });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return { id: created.id, token: res.body.token, name, email };
}

// Request helpers (a user object carries its token)
const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
const get = (user, path) => request(app).get(`/api/admin${path}`).set(auth(user));
const patch = (user, path, body) => request(app).patch(`/api/admin${path}`).set(auth(user)).send(body);
const del = (user, path) => request(app).delete(`/api/admin${path}`).set(auth(user));

const book = (userId, extra = {}) => ({
  title: "Test Book",
  author: "Test Author",
  genre: "Test Genre",
  price: 10,
  status: "to_read", // database value
  userId,
  ...extra,
});

let admin;
let user;

beforeAll(async () => {
  // Remove leftovers of earlier crashed runs, then create this run's users
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  admin = await newAdmin("Admin");
  user = await newUser("Plain");
}, 30000);

// Deleting the users also deletes their books (cascade)
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("access control", () => {
  const routes = [
    ["get", "/stats"],
    ["get", "/users"],
    ["patch", "/users/1"],
    ["delete", "/users/1"],
    ["get", "/genres"],
    ["get", "/books"],
    ["get", "/books/1"],
    ["patch", "/books/1"],
    ["delete", "/books/1"],
  ];

  it("returns 401 on every route without a token", async () => {
    for (const [method, path] of routes) {
      const res = await request(app)[method](`/api/admin${path}`).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("returns 403 for a normal user on every route", async () => {
    for (const [method, path] of routes) {
      const res = await request(app)[method](`/api/admin${path}`).set(auth(user)).send({});
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("returns 200 for an admin on the GET routes", async () => {
    for (const path of ["/stats", "/users", "/genres", "/books"]) {
      const res = await get(admin, path);
      expect(res.status, path).toBe(200);
    }
  });

  it("returns 401 for an expired token", async () => {
    const expired = jwt.sign({ sub: String(admin.id), exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET);
    const res = await get({ token: expired }, "/stats");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a token with a changed signature", async () => {
    const [header, payload, signature] = admin.token.split(".");
    const changed = [header, payload, signature.split("").reverse().join("")].join(".");
    expect(changed).not.toBe(admin.token);
    const res = await get({ token: changed }, "/stats");
    expect(res.status).toBe(401);
  });
});

describe("pure stats helpers", () => {
  it("toMoney gives 0 for no books and a 2-decimal number otherwise", () => {
    expect(toMoney(null)).toBe(0);
    expect(toMoney({ toFixed: () => "12.50" })).toBe(12.5);
  });

  it("statusCounts has all three statuses, 0 when empty", () => {
    expect(statusCounts([])).toEqual({ reading: 0, completed: 0, "to-read": 0 });
    expect(statusCounts([{ status: "to_read", _count: { _all: 4 } }])).toEqual({
      reading: 0,
      completed: 0,
      "to-read": 4,
    });
  });

  it("topGenresFrom merges case variants, keeps the capitalised spelling and returns at most 5", () => {
    expect(topGenresFrom([])).toEqual([]);
    const rows = [
      { genre: "sci-fi", _count: { _all: 2 } },
      { genre: "Sci-Fi", _count: { _all: 3 } },
      { genre: "Fantasy", _count: { _all: 4 } },
      ...["a", "b", "c", "d", "e"].map((genre) => ({ genre, _count: { _all: 1 } })),
    ];
    const top = topGenresFrom(rows);
    expect(top).toHaveLength(5);
    expect(top[0]).toEqual({ genre: "Sci-Fi", count: 5 });
    expect(top[1]).toEqual({ genre: "Fantasy", count: 4 });
  });
});

describe("GET /api/admin/stats", () => {
  const bigGenre = `ZZ-${runId}`;

  beforeAll(async () => {
    // 60 books in one genre written with two spellings: more than any other genre in the database
    const owner = await newUser("Stats Owner");
    await prisma.book.createMany({
      data: [
        ...Array.from({ length: 30 }, () => book(owner.id, { genre: bigGenre, price: 1.25, status: "reading" })),
        ...Array.from({ length: 30 }, () => book(owner.id, { genre: bigGenre.toLowerCase(), price: 2.5 })),
      ],
    });
  }, 30000);

  it("matches direct Prisma queries and never includes passwordHash", async () => {
    const res = await get(admin, "/stats");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const [users, admins, books, sum, reading, completed, toRead] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.book.count(),
      prisma.book.aggregate({ _sum: { price: true } }),
      prisma.book.count({ where: { status: "reading" } }),
      prisma.book.count({ where: { status: "completed" } }),
      prisma.book.count({ where: { status: "to_read" } }),
    ]);

    expect(res.body.totals).toEqual({ users, admins, books });
    expect(res.body.libraryValue).toBe(Number(sum._sum.price.toFixed(2)));
    expect(res.body.booksByStatus).toEqual({ reading, completed, "to-read": toRead });
  });

  it("merges genre spellings in topGenres and keeps the capitalised one", async () => {
    const res = await get(admin, "/stats");
    expect(res.body.topGenres.length).toBeLessThanOrEqual(5);
    expect(res.body.topGenres[0]).toEqual({ genre: bigGenre, count: 60 });
  });

  it("lists the 5 newest users with booksCount, and the admins", async () => {
    const res = await get(admin, "/stats");
    const newest = await prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true },
    });

    expect(res.body.recentUsers.map((u) => u.id)).toEqual(newest.map((u) => u.id));
    for (const u of res.body.recentUsers) expect(typeof u.booksCount).toBe("number");
    expect(res.body.admins.map((a) => a.id)).toContain(admin.id);
    expect(Object.keys(res.body.admins[0]).sort()).toEqual(["createdAt", "email", "id", "name"]);
  });
});

describe("users", () => {
  let alpha, bravo, charlie;

  beforeAll(async () => {
    alpha = await newUser("Alpha");
    bravo = await newUser("Bravo");
    charlie = await newUser("Charlie");
    // Alpha has 2 books, Charlie 1, Bravo none
    await prisma.book.createMany({ data: [book(alpha.id), book(alpha.id), book(charlie.id)] });
  }, 30000);

  it("searches name and email case-insensitively", async () => {
    const byName = await get(admin, `/users?q=${tag.toLowerCase()}&limit=50`);
    expect(byName.status).toBe(200);
    // the admin, the plain user and Alpha/Bravo/Charlie all carry the tag (plus the stats owner)
    const ids = byName.body.users.map((u) => u.id);
    for (const id of [admin.id, user.id, alpha.id, bravo.id, charlie.id]) expect(ids).toContain(id);

    const byEmail = await get(admin, `/users?q=${bravo.email.toUpperCase()}`);
    expect(byEmail.body.total).toBe(1);
    expect(byEmail.body.users[0].id).toBe(bravo.id);
  });

  it("filters by role", async () => {
    const admins = await get(admin, `/users?q=${tag}&role=admin&limit=50`);
    expect(admins.body.users.map((u) => u.id)).toEqual([admin.id]);

    const users = await get(admin, `/users?q=${tag}&role=user&limit=50`);
    expect(users.body.users.every((u) => u.role === "user")).toBe(true);
    expect(users.body.users.map((u) => u.id)).not.toContain(admin.id);
  });

  it("includes booksCount and never passwordHash", async () => {
    const res = await get(admin, `/users?q=${tag}&limit=50`);
    const byId = Object.fromEntries(res.body.users.map((u) => [u.id, u]));

    expect(byId[alpha.id].booksCount).toBe(2);
    expect(byId[bravo.id].booksCount).toBe(0);
    expect(byId[charlie.id].booksCount).toBe(1);
    expect(Object.keys(byId[alpha.id]).sort()).toEqual(["booksCount", "createdAt", "email", "id", "name", "role"]);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("sorts by name, email, createdAt and books", async () => {
    const mine = [admin.id, user.id, alpha.id, bravo.id, charlie.id];
    const ids = async (query) => {
      const res = await get(admin, `/users?q=${tag}&limit=50&${query}`);
      expect(res.status).toBe(200);
      return res.body.users.map((u) => u.id).filter((id) => mine.includes(id));
    };

    // names: "... Admin" < "... Alpha" < "... Bravo" < "... Charlie" < "... Plain"
    expect(await ids("sort=name&order=asc")).toEqual([admin.id, alpha.id, bravo.id, charlie.id, user.id]);
    expect(await ids("sort=name&order=desc")).toEqual([user.id, charlie.id, bravo.id, alpha.id, admin.id]);
    // created in this order (emails are numbered in creation order too)
    expect(await ids("sort=createdAt&order=asc")).toEqual([admin.id, user.id, alpha.id, bravo.id, charlie.id]);
    expect(await ids("sort=email&order=asc")).toEqual([admin.id, user.id, alpha.id, bravo.id, charlie.id]);
    // by number of books: Alpha 2, Charlie 1, then the others (0)
    const byBooks = await ids("sort=books&order=desc");
    expect(byBooks.slice(0, 2)).toEqual([alpha.id, charlie.id]);
  });

  it("paginates", async () => {
    const first = await get(admin, `/users?q=${tag}&sort=name&order=asc&limit=2&page=1`);
    const second = await get(admin, `/users?q=${tag}&sort=name&order=asc&limit=2&page=2`);

    expect(first.body).toMatchObject({ page: 1, limit: 2 });
    expect(second.body).toMatchObject({ page: 2, limit: 2 });
    expect(first.body.total).toBe(second.body.total);
    expect(first.body.total).toBeGreaterThanOrEqual(6);
    expect(first.body.users).toHaveLength(2);
    const firstIds = first.body.users.map((u) => u.id);
    for (const u of second.body.users) expect(firstIds).not.toContain(u.id);
  });

  it("rejects invalid query values with 400", async () => {
    for (const query of ["sort=passwordHash", "role=root", "limit=51", "limit=0", "page=0", "order=up"]) {
      const res = await get(admin, `/users?${query}`);
      expect(res.status, query).toBe(400);
    }
  });

  it("changes another user's role, and it takes effect immediately", async () => {
    const promoted = await patch(admin, `/users/${bravo.id}`, { role: "admin" });
    expect(promoted.status).toBe(200);
    expect(promoted.body).toMatchObject({ id: bravo.id, role: "admin", booksCount: 0 });
    expect(JSON.stringify(promoted.body)).not.toContain("passwordHash");

    expect((await get(bravo, "/stats")).status).toBe(200);

    const demoted = await patch(admin, `/users/${bravo.id}`, { role: "user" });
    expect(demoted.body.role).toBe("user");
    expect((await get(bravo, "/stats")).status).toBe(403);
  });

  it("validates the role body and the id", async () => {
    expect((await patch(admin, `/users/${bravo.id}`, { role: "root" })).status).toBe(400);
    expect((await patch(admin, `/users/${bravo.id}`, {})).status).toBe(400);
    const badId = await patch(admin, "/users/abc", { role: "user" });
    expect(badId.status).toBe(400);
    expect(JSON.stringify(badId.body)).toContain("User id must be a positive integer");
  });

  it("returns 404 'User not found' for an unknown id", async () => {
    for (const res of [await patch(admin, "/users/2147483647", { role: "user" }), await del(admin, "/users/2147483647")]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "User not found" });
    }
  });

  it("does not let an admin change their own role or delete themselves (403)", async () => {
    const role = await patch(admin, `/users/${admin.id}`, { role: "user" });
    expect(role.status).toBe(403);
    expect(role.body.error).toMatch(/own role/);

    const removal = await del(admin, `/users/${admin.id}`);
    expect(removal.status).toBe(403);
    expect(removal.body.error).toMatch(/own account/);

    const stillThere = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stillThere.role).toBe("admin");
  });

  it("deletes a user together with their books", async () => {
    const victim = await newUser("Victim");
    await prisma.book.createMany({ data: [book(victim.id), book(victim.id)] });

    const res = await del(admin, `/users/${victim.id}`);
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: victim.id } })).toBeNull();
    expect(await prisma.book.count({ where: { userId: victim.id } })).toBe(0);
  });
});

describe("books (all users)", () => {
  const bookTag = `Tag${runId}`; // in every title created here
  const genreCapital = `GX${runId}`;
  const genreLower = `gx${runId}`;
  let ownerA, ownerB, bookA1;

  beforeAll(async () => {
    ownerA = await newUser("Owner A");
    ownerB = await newUser("Owner B");
    await prisma.book.createMany({
      data: [
        book(ownerA.id, { title: `${bookTag} One`, genre: genreCapital, price: 30, status: "reading" }),
        book(ownerA.id, { title: `${bookTag} Two`, author: "Jane Roe", genre: genreLower, price: 10, status: "completed" }),
        book(ownerB.id, { title: `${bookTag} Three`, genre: genreCapital, price: 20, status: "reading" }),
        book(ownerB.id, { title: `${bookTag} Four`, genre: "Other", price: 5, status: "to_read" }),
      ],
    });
    bookA1 = await prisma.book.findFirst({ where: { userId: ownerA.id, title: `${bookTag} One` } });
  }, 30000);

  it("lists books of every user with an owner of id, name and email only", async () => {
    const res = await get(admin, `/books?q=${bookTag}&limit=50`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 50, total: 4 });

    const owners = new Set(res.body.books.map((b) => b.owner.id));
    expect(owners).toEqual(new Set([ownerA.id, ownerB.id]));
    for (const b of res.body.books) {
      expect(Object.keys(b.owner).sort()).toEqual(["email", "id", "name"]);
      expect(b.userId).toBe(b.owner.id);
      expect(typeof b.price).toBe("number");
      expect(["reading", "completed", "to-read"]).toContain(b.status);
    }
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("filters by q (title or author, case-insensitive)", async () => {
    const byTitle = await get(admin, `/books?q=${bookTag.toLowerCase()}%20one`);
    expect(byTitle.body.total).toBe(1);

    const byAuthor = await get(admin, "/books?q=jane%20roe");
    expect(byAuthor.body.books.map((b) => b.id)).toContain(
      (await prisma.book.findFirst({ where: { userId: ownerA.id, title: `${bookTag} Two` } })).id,
    );
  });

  it("filters by genre (case-insensitive exact)", async () => {
    const res = await get(admin, `/books?q=${bookTag}&genre=${genreLower}&limit=50`);
    expect(res.body.total).toBe(3); // both spellings match
    expect(res.body.books.every((b) => b.genre.toLowerCase() === genreLower)).toBe(true);
  });

  it("filters by status", async () => {
    const res = await get(admin, `/books?q=${bookTag}&status=reading&limit=50`);
    expect(res.body.total).toBe(2);
    expect(res.body.books.every((b) => b.status === "reading")).toBe(true);

    const toRead = await get(admin, `/books?q=${bookTag}&status=to-read`);
    expect(toRead.body.total).toBe(1);
  });

  it("filters by userId", async () => {
    const res = await get(admin, `/books?userId=${ownerA.id}&limit=50`);
    expect(res.body.total).toBe(2);
    expect(res.body.books.every((b) => b.owner.id === ownerA.id)).toBe(true);

    const none = await get(admin, "/books?userId=2147483647");
    expect(none.status).toBe(200);
    expect(none.body.total).toBe(0);

    expect((await get(admin, "/books?userId=abc")).status).toBe(400);
    expect((await get(admin, "/books?userId=0")).status).toBe(400);
    expect((await get(admin, "/books?userId=")).status).toBe(200); // empty = no filter
  });

  it("sorts and paginates", async () => {
    const asc = await get(admin, `/books?q=${bookTag}&sort=price&order=asc&limit=50`);
    expect(asc.body.books.map((b) => b.price)).toEqual([5, 10, 20, 30]);

    const page2 = await get(admin, `/books?q=${bookTag}&sort=price&order=asc&limit=2&page=2`);
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 4 });
    expect(page2.body.books.map((b) => b.price)).toEqual([20, 30]);
  });

  it("rejects invalid query values with 400", async () => {
    for (const query of ["sort=owner", "status=done", "limit=51", "page=0"]) {
      expect((await get(admin, `/books?${query}`)).status, query).toBe(400);
    }
  });

  it("gets any user's book by id", async () => {
    const res = await get(admin, `/books/${bookA1.id}`);
    expect(res.status).toBe(200);
    expect(res.body.owner.id).toBe(ownerA.id);

    expect((await get(admin, "/books/2147483647")).body).toEqual({ error: "Book not found" });
    expect((await get(admin, "/books/abc")).status).toBe(400);
  });

  it("edits another user's book and the owner stays the same", async () => {
    // userId in the body must be ignored
    const res = await patch(admin, `/books/${bookA1.id}`, { title: `${bookTag} Edited`, price: 41.5, status: "completed", userId: ownerB.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: `${bookTag} Edited`, price: 41.5, status: "completed", userId: ownerA.id });
    expect(res.body.owner.id).toBe(ownerA.id);
    expect((await prisma.book.findUnique({ where: { id: bookA1.id } })).userId).toBe(ownerA.id);

    expect((await patch(admin, `/books/${bookA1.id}`, {})).status).toBe(400);
    expect((await patch(admin, "/books/2147483647", { title: "x" })).body).toEqual({ error: "Book not found" });
  });

  it("deletes another user's book", async () => {
    const victim = await prisma.book.create({ data: book(ownerB.id, { title: `${bookTag} Doomed` }) });

    expect((await del(admin, `/books/${victim.id}`)).status).toBe(204);
    expect(await prisma.book.findUnique({ where: { id: victim.id } })).toBeNull();

    const again = await del(admin, `/books/${victim.id}`);
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ error: "Book not found" });
  });

  it("lists all genres, case variants merged and sorted", async () => {
    const res = await get(admin, "/genres");
    expect(res.status).toBe(200);

    const lower = res.body.genres.map((g) => g.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length); // no case duplicates
    expect(res.body.genres).toContain(genreCapital); // the capitalised spelling is kept
    expect(res.body.genres).not.toContain(genreLower);
    const sorted = [...res.body.genres].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(res.body.genres).toEqual(sorted);
  });
});
