// Integration tests for /api/ai. They use the real database (the Postgres container must be running).
// The dev database also holds demo data, so no test asserts absolute totals: numbers are compared with
// direct Prisma queries, or with data created here and tagged with a unique per-run text.
// Several users are created (one group of tests per user) so no test can hit the rate limit of another.
import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { examplesFor } from "../src/ai/intents.js";
import { AI_RATE_LIMIT } from "../src/middleware/rateLimit.js";

const runId = Date.now();
const tag = `Ai${runId}`; // in every name created here
const password = crypto.randomBytes(16).toString("hex"); // random for every run
const EMAIL_PREFIX = "auth-test-ai-";
const createdEmails = [];
let counter = 0;

function nextEmail() {
  const email = `${EMAIL_PREFIX}${runId}-${String(counter++).padStart(3, "0")}@example.test`;
  createdEmails.push(email);
  return email;
}

// A normal user, registered through the API
async function newUser(label) {
  const name = `${tag} ${label}`;
  const email = nextEmail();
  const res = await request(app).post("/api/auth/register").send({ name, email, password });
  return { id: res.body.user.id, token: res.body.token, name, email };
}

// An admin: created with Prisma (register never makes admins), then logged in through the API
async function newAdmin(label) {
  const name = `${tag} ${label}`;
  const email = nextEmail();
  const passwordHash = await bcrypt.hash(password, 4);
  const created = await prisma.user.create({ data: { name, email, passwordHash, role: "admin" } });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return { id: created.id, token: res.body.token, name, email };
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

// Every response body is remembered, so one test can check that none of them ever contained a password hash
const bodies = [];
const aliceBodies = []; // only what Alice (a normal user) was answered
async function ask(user, question) {
  const res = await request(app).post("/api/ai/query").set(auth(user)).send({ question });
  bodies.push(JSON.stringify(res.body));
  if (user === alice) aliceBodies.push(JSON.stringify(res.body));
  return res;
}

const book = (userId, title, author, genre, price, status) => ({ userId, title, author, genre, price, status });

let alice, bea, admin, admin2;
const popTitle = `PopX${runId} Title`;
const popGenre = `Pg${runId}`;

// These tests are about the rules. Switch the optional LLM off (even if the root .env enables it) so they never reach a network.
const savedLlmEnv = {};
for (const key of Object.keys(process.env)) if (key.startsWith("AI_LLM_")) savedLlmEnv[key] = process.env[key];

beforeAll(async () => {
  for (const key of Object.keys(savedLlmEnv)) delete process.env[key];
  // Remove leftovers of earlier crashed runs, then create this run's users and data
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  alice = await newUser("Alice");
  bea = await newUser("Bea");
  admin = await newAdmin("Admin One");
  admin2 = await newAdmin("Admin Two");

  const fa = `Fa${runId}`;
  await prisma.book.createMany({
    data: [
      // Alice: "Sf" and "sf" are the same genre written two ways; Fa is shared with Bea on purpose
      book(alice.id, `${tag} Alpha`, `Ann${runId}`, `Sf${runId}`, 50, "completed"),
      book(alice.id, `${tag} Bravo`, `Ann${runId}`, `sf${runId}`, 30.5, "reading"),
      book(alice.id, `${tag} Charlie`, `Bob${runId}`, fa, 10, "to_read"),
      book(alice.id, `${tag} Delta`, `Bob${runId}`, fa, 20, "completed"),
      book(alice.id, `${tag} Echo`, `Cy${runId}`, fa, 5.25, "to_read"),
      book(alice.id, `${tag} Foxtrot`, `Cy${runId}`, `Hi${runId}`, 99.99, "completed"),
      // Bea
      book(bea.id, `${tag} Zulu`, `Zed${runId}`, fa, 77, "reading"),
      book(bea.id, `${tag} Yankee`, `Zed${runId}`, `Yo${runId}`, 120, "completed"),
      // The admin's own books
      book(admin.id, `${tag} AdminBook1`, `Ad${runId}`, `Ab${runId}`, 1.5, "to_read"),
      book(admin.id, `${tag} AdminBook2`, `Ad${runId}`, `Ab${runId}`, 2.5, "reading"),
      // The same title written in three ways, owned by 3 users; Alice owns it twice (still counts once)
      book(alice.id, popTitle, "PopAu", popGenre, 9.99, "to_read"),
      book(alice.id, popTitle, "PopAu", popGenre, 9.99, "to_read"),
      book(bea.id, popTitle.toLowerCase(), "PopAu", popGenre, 9.99, "to_read"),
      book(admin.id, popTitle.toUpperCase(), "PopAu", popGenre, 9.99, "to_read"),
    ],
  });
}, 60000);

// Deleting the users also deletes their books (cascade)
afterAll(async () => {
  Object.assign(process.env, savedLlmEnv);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("access and validation", () => {
  let user;
  beforeAll(async () => {
    user = await newUser("Validation");
  });

  it("returns 401 without a token", async () => {
    expect((await request(app).post("/api/ai/query").send({ question: "hello" })).status).toBe(401);
    expect((await request(app).get("/api/ai/examples")).status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const res = await request(app).post("/api/ai/query").set({ Authorization: "Bearer not-a-token" }).send({ question: "hello" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing, empty, blank, too long or wrongly typed question", async () => {
    const bad = [{}, { question: "" }, { question: "   " }, { question: "a".repeat(301) }, { question: 123 }, { question: null }, { question: ["a"] }, { question: { a: 1 } }];
    for (const body of bad) {
      const res = await request(app).post("/api/ai/query").set(auth(user)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details.length).toBeGreaterThan(0);
    }
  });

  it("returns 400 for a body that is not JSON", async () => {
    const res = await request(app).post("/api/ai/query").set(auth(user)).set("Content-Type", "application/json").send("{not json");
    expect(res.status).toBe(400);
  });

  it("accepts exactly 300 characters and trims the question", async () => {
    const res = await ask(user, `   ${"a".repeat(300)}   `);
    expect(res.status).toBe(200);
    expect(res.body.question).toBe("a".repeat(300));
  });
});

describe("unsupported questions", () => {
  let user;
  beforeAll(async () => {
    user = await newUser("Unsupported");
  });

  it("answers with a friendly message and examples", async () => {
    const res = await ask(user, "What is the weather today?");
    expect(res.status).toBe(200);
    expect(res.body.understood).toEqual({ intent: "unsupported", params: {}, source: "rules" });
    expect(res.body.answer).toMatchObject({ type: "message", title: "I can't answer that" });
    expect(res.body.answer.suggestions).toEqual(examplesFor("user"));
  });

  it("treats SQL-looking input as plain text", async () => {
    const before = await prisma.book.count();
    for (const question of ["'; DROP TABLE books; --", "1; DELETE FROM users WHERE 1=1", "show books'; DROP TABLE users; --"]) {
      const res = await ask(user, question);
      expect(res.status, question).toBe(200);
      expect(["message", "table"]).toContain(res.body.answer.type);
    }
    // The tables are still there and nothing was deleted
    expect(await prisma.book.count()).toBe(before);
    expect(await prisma.user.count()).toBeGreaterThan(0);
  });

  it("answers the plain SQL-looking text as unsupported", async () => {
    const res = await ask(user, "'; DROP TABLE books; --");
    expect(res.body.understood.intent).toBe("unsupported");
    expect(res.body.answer.type).toBe("message");
  });
});

describe("a normal user only ever sees their own books", () => {
  // Everything another user owns must never show up in Alice's answers
  const forbidden = () => [bea.email, bea.name, admin.email, admin.name, `Zulu`, `Yankee`, `Zed${runId}`, `Ad${runId}`, `AdminBook`];

  it("Show the five most expensive books", async () => {
    const res = await ask(alice, "Show the five most expensive books");
    expect(res.status).toBe(200);
    expect(res.body.understood).toEqual({
      intent: "list_books",
      params: { scope: "mine", sort: "price", order: "desc", limit: 5 },
      source: "rules",
    });

    const expected = await prisma.book.findMany({
      where: { userId: alice.id },
      orderBy: [{ price: "desc" }, { id: "desc" }],
      take: 5,
    });
    expect(res.body.answer.type).toBe("table");
    expect(res.body.answer.rows.map((row) => row.title)).toEqual(expected.map((b) => b.title));
    expect(res.body.answer.rows.map((row) => row.price)).toEqual(expected.map((b) => Number(b.price)));
    expect(res.body.answer.columns.map((c) => c.key)).not.toContain("owner");
    for (const row of res.body.answer.rows) expect(typeof row.price).toBe("number");
  });

  it("list my books of a genre that Bea also owns", async () => {
    const res = await ask(alice, `show my books with genre Fa${runId}`);
    const titles = res.body.answer.rows.map((row) => row.title).sort();
    expect(titles).toEqual([`${tag} Charlie`, `${tag} Delta`, `${tag} Echo`]);
  });

  it("a normal user cannot widen the scope with words like 'everyone's' or 'all users'", async () => {
    for (const question of ["list everyone's books", "show all users books", "show the five most expensive books of all users"]) {
      const res = await ask(alice, question);
      expect(res.status).toBe(200);
      expect(res.body.understood.params.scope, question).toBe("mine");
      const owners = JSON.stringify(res.body.answer);
      for (const word of forbidden()) expect(owners, `${question} / ${word}`).not.toContain(word);
    }
  });

  it("book_stats match the database", async () => {
    const where = { userId: alice.id };
    const aggregate = await prisma.book.aggregate({
      where,
      _sum: { price: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    });
    const completed = await prisma.book.count({ where: { ...where, status: "completed" } });

    const count = await ask(alice, "How many books have I completed?");
    expect(count.body.answer).toMatchObject({ type: "number", value: completed, format: "count" });

    const sum = await ask(alice, "What is the total value of my library?");
    expect(sum.body.answer).toMatchObject({ type: "number", format: "price" });
    expect(sum.body.answer.value).toBe(Number(aggregate._sum.price.toFixed(2)));

    const avg = await ask(alice, "What is the average price of my books?");
    expect(avg.body.answer.value).toBe(Number(aggregate._avg.price.toFixed(2)));

    const min = await ask(alice, "What is the lowest price of my books?");
    expect(min.body.answer.value).toBe(Number(aggregate._min.price));

    const max = await ask(alice, "What is the highest price of my books?");
    expect(max.body.answer.value).toBe(Number(aggregate._max.price));
  });

  it("book_stats with a filter and with no matching books", async () => {
    const fantasy = await ask(alice, `how many books do I have with genre Fa${runId}`);
    expect(fantasy.body.answer.value).toBe(3);

    const none = await ask(alice, `what is the average price of my books with genre Nothing${runId}`);
    expect(none.body.answer.type).toBe("message");
    expect(none.body.answer.summary).toMatch(/no books match/i);
  });

  it("top_genres merges Sf and sf and keeps the capitalised spelling", async () => {
    const res = await ask(alice, "What are my top genres?");
    const rows = res.body.answer.rows;
    expect(res.body.answer.type).toBe("table");
    expect(rows.find((row) => row.genre === `Fa${runId}`).books).toBe(3);
    expect(rows.find((row) => row.genre === `Sf${runId}`).books).toBe(2);
    expect(rows.find((row) => row.genre === `sf${runId}`)).toBeUndefined();
    expect(rows[0]).toEqual({ genre: `Fa${runId}`, books: 3 });
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it("top_authors counts only Alice's books", async () => {
    const res = await ask(alice, "Who are my top authors?");
    const rows = res.body.answer.rows;
    expect(rows.find((row) => row.author === `Ann${runId}`).books).toBe(2);
    expect(rows.find((row) => row.author === `Zed${runId}`)).toBeUndefined();
  });

  it("status_breakdown matches the database, with API status names", async () => {
    const res = await ask(alice, "Show my books by status");
    const expected = {};
    for (const status of ["reading", "completed", "to_read"]) {
      expected[status === "to_read" ? "to-read" : status] = await prisma.book.count({ where: { userId: alice.id, status } });
    }
    expect(Object.fromEntries(res.body.answer.rows.map((row) => [row.status, row.books]))).toEqual(expected);
    expect(JSON.stringify(res.body)).not.toContain("to_read");
  });

  it("never contains another user's data in any of Alice's answers", async () => {
    // Every answer given to Alice in this file
    expect(aliceBodies.length).toBeGreaterThan(8);
    for (const body of aliceBodies) {
      for (const word of forbidden()) expect(body, word).not.toContain(word);
    }
  });
});

describe("admin-only questions are blocked for normal users", () => {
  let user;
  beforeAll(async () => {
    user = await newUser("Blocked");
  });

  it("answers 200 with a message and suggestions, and never runs the query", async () => {
    for (const question of ["Who owns the most books?", "Which is the most popular book?", "How many users are there?"]) {
      const res = await ask(user, question);
      expect(res.status, question).toBe(200);
      expect(res.body.answer.type, question).toBe("message");
      expect(res.body.answer.title).toBe("That question is for admins");
      expect(res.body.answer.suggestions.length).toBeGreaterThan(0);
      expect(res.body.answer.suggestions).not.toContain("Who owns the most books?");
      expect(res.body.answer.rows).toEqual([]);
      // No names, emails or titles of other people in the answer
      const text = JSON.stringify(res.body.answer);
      for (const word of [alice.email, alice.name, bea.email, admin.email, popTitle]) expect(text).not.toContain(word);
    }
  });

  it("a question about another user's books is blocked too", async () => {
    const res = await ask(user, `show books owned by ${alice.name}`);
    expect(res.status).toBe(200);
    expect(res.body.answer.type).toBe("message");
    expect(res.body.answer.title).toBe("That question is for admins");
    expect(JSON.stringify(res.body)).not.toContain(`${tag} Alpha`);
  });
});

describe("admins see everyone's books", () => {
  it("lists all users' books with the owner name", async () => {
    const res = await ask(admin, "Show the five most expensive books");
    expect(res.body.understood.params.scope).toBe("all");

    const expected = await prisma.book.findMany({
      orderBy: [{ price: "desc" }, { id: "desc" }],
      take: 5,
      include: { user: { select: { name: true } } },
    });
    expect(res.body.answer.rows.map((row) => row.id)).toEqual(expected.map((b) => b.id));
    expect(res.body.answer.rows.map((row) => row.owner)).toEqual(expected.map((b) => b.user.name));
    expect(res.body.answer.columns.map((c) => c.key)).toContain("owner");
    expect(JSON.stringify(res.body)).not.toContain("@example"); // owner names only, no emails in book rows
  });

  it("'my books' means only the admin's own", async () => {
    const res = await ask(admin, "list my books");
    expect(res.body.understood.params.scope).toBe("mine");
    const titles = res.body.answer.rows.map((row) => row.title);
    for (const title of titles) expect(title.startsWith(tag) || title.toLowerCase() === popTitle.toLowerCase(), title).toBe(true);
    expect(titles.every((title) => !title.includes("Alpha") && !title.includes("Zulu"))).toBe(true);
    expect(res.body.answer.columns.map((c) => c.key)).not.toContain("owner");
  });

  it("an owner name filter returns only that user's books", async () => {
    const res = await ask(admin, `show books owned by ${bea.name}`);
    expect(res.body.understood.params.ownerName).toBe(bea.name);
    const expected = await prisma.book.count({ where: { userId: bea.id } });
    expect(res.body.answer.rows).toHaveLength(Math.min(expected, 5));
    expect(res.body.answer.rows.every((row) => row.owner === bea.name)).toBe(true);
  });

  it("book_stats cover every user", async () => {
    const count = await ask(admin, "How many books are there?");
    expect(count.body.answer.value).toBe(await prisma.book.count());

    const aggregate = await prisma.book.aggregate({ _sum: { price: true } });
    const sum = await ask(admin, "What is the total value of all books?");
    expect(sum.body.answer.value).toBe(Number(aggregate._sum.price.toFixed(2)));
  });

  it("count_users matches the database", async () => {
    const res = await ask(admin, "How many users are there?");
    expect(res.body.answer).toMatchObject({ type: "number", value: await prisma.user.count(), format: "count" });
    expect(res.body.answer.summary).toContain("admin");
  });

  it("top_owners ranks users by number of books", async () => {
    const res = await ask(admin, "Who owns the most books?");
    expect(res.body.answer.type).toBe("table");

    const expected = await prisma.user.findMany({
      where: { books: { some: {} } },
      orderBy: [{ books: { _count: "desc" } }, { name: "asc" }, { id: "asc" }],
      take: 5,
      select: { name: true, email: true, _count: { select: { books: true } } },
    });
    expect(res.body.answer.rows).toEqual(expected.map((u) => ({ name: u.name, email: u.email, books: u._count.books })));
    expect(res.body.answer.summary).toContain(expected[0].name);
  });

  it("top_owners with a bigger limit contains the test users with their exact counts", async () => {
    const res = await ask(admin, "Show the top 25 owners");
    const byEmail = Object.fromEntries(res.body.answer.rows.map((row) => [row.email, row.books]));
    expect(byEmail[alice.email]).toBe(await prisma.book.count({ where: { userId: alice.id } }));
    expect(byEmail[bea.email]).toBe(await prisma.book.count({ where: { userId: bea.id } }));
    expect(res.body.answer.rows.length).toBeLessThanOrEqual(25);
  });

  it("popular_books counts different users, ignoring case, and a duplicate by one user once", async () => {
    const res = await ask(admin, "Show the 25 most popular books");
    expect(res.body.understood.params.limit).toBe(25);
    const row = res.body.answer.rows.find((r) => r.title.toLowerCase() === popTitle.toLowerCase());
    expect(row).toBeDefined();
    expect(row.owners).toBe(3); // Alice (twice), Bea and the admin
    expect(row.title).toBe(popTitle.toUpperCase()); // the capitalised spelling is shown
    // sorted by owners, biggest first
    const owners = res.body.answer.rows.map((r) => r.owners);
    expect(owners).toEqual([...owners].sort((a, b) => b - a));

    const popular = await ask(admin, "Which is the most popular book?");
    expect(popular.body.answer.type).toBe("table");
    expect(popular.body.answer.rows.length).toBeLessThanOrEqual(5);
    expect(popular.body.answer.summary).toContain("most popular book");
  });

  it("never returns more than 25 rows", async () => {
    const res = await ask(admin, "list 100 books");
    expect(res.status).toBe(200);
    expect(res.body.understood.params.limit).toBe(25);
    expect(res.body.answer.rows.length).toBeLessThanOrEqual(25);
  });
});

describe("examples", () => {
  let user;
  beforeAll(async () => {
    user = await newUser("Examples");
  });

  it("GET /api/ai/examples is role based", async () => {
    const asUser = await request(app).get("/api/ai/examples").set(auth(user));
    expect(asUser.status).toBe(200);
    expect(asUser.body.examples).toEqual(examplesFor("user"));
    expect(asUser.body.examples).not.toContain("Who owns the most books?");

    const asAdmin = await request(app).get("/api/ai/examples").set(auth(admin2));
    expect(asAdmin.body.examples).toEqual(examplesFor("admin"));
    expect(asAdmin.body.examples).toContain("Who owns the most books?");
  });

  it("every example gets a real answer (not an error message) for its role", async () => {
    for (const question of examplesFor("user")) {
      const res = await ask(user, question);
      expect(res.status, question).toBe(200);
      expect(["table", "number"], question).toContain(res.body.answer.type);
    }
    for (const question of examplesFor("admin")) {
      const res = await ask(admin2, question);
      expect(res.status, question).toBe(200);
      expect(["table", "number"], question).toContain(res.body.answer.type);
    }
  });
});

describe("rate limit", () => {
  it(`allows ${AI_RATE_LIMIT.limit} requests per minute per user, then answers 429 with Retry-After`, async () => {
    const limited = await newUser("Limited");
    const other = await newUser("Other");

    for (let i = 0; i < AI_RATE_LIMIT.limit; i += 1) {
      const res = await request(app).get("/api/ai/examples").set(auth(limited));
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
    const blocked = await request(app).post("/api/ai/query").set(auth(limited)).send({ question: "How many books do I have?" });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThanOrEqual(1);
    expect(Number(blocked.headers["retry-after"])).toBeLessThanOrEqual(60);
    expect(blocked.body.error).toMatch(/Too many requests/);

    // Another user is not affected
    expect((await request(app).get("/api/ai/examples").set(auth(other))).status).toBe(200);
  });
});

describe("logging and secrets", () => {
  it("never logs the question text", async () => {
    const user = await newUser("Logging");
    const secret = `zzlogcheck${runId}`;
    const spies = ["log", "info", "warn", "error", "debug"].map((method) => vi.spyOn(console, method).mockImplementation(() => {}));

    await ask(user, `show my books with genre ${secret}`);
    await ask(user, `tell me about ${secret}`);

    const logged = spies.flatMap((spy) => spy.mock.calls).map((args) => JSON.stringify(args));
    spies.forEach((spy) => spy.mockRestore());
    for (const line of logged) expect(line).not.toContain(secret);
  });

  it("no response ever contained a password hash", () => {
    expect(bodies.length).toBeGreaterThan(20);
    for (const body of bodies) {
      expect(body).not.toContain("passwordHash");
      expect(body).not.toMatch(/\$2[aby]\$/); // the start of a bcrypt hash
    }
  });
});
