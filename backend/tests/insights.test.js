// Tests for the insights endpoints: GET /api/insights/*, GET /api/admin/insights, GET /api/admin/users/:id/insights
// and the new fields of GET /api/admin/stats. They use the real database (the Postgres container must be running).
// The dev database also holds demo data, so no test asserts absolute totals: numbers are compared with
// direct Prisma queries, or with data created here (tagged with a unique per-run text).
// Test users are new; the seeded admin and its password are never used.
import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { topCounts } from "../src/lib/bookHelpers.js";
import {
  percent,
  lastDays,
  fillDays,
  mergeGenres,
  summarySentence,
  adminSentences,
  recommendationReason,
  formatMoneyText,
  CURRENCY_SYMBOL,
  dayKey,
} from "../src/lib/insightHelpers.js";

const runId = Date.now();
const tag = `Ins${runId}`; // in every title and genre created here
const personTag = `Person${runId}`; // in every user name (kept apart from the book tag so leaks are detectable)
const password = crypto.randomBytes(16).toString("hex"); // random for every run
const EMAIL_PREFIX = "auth-test-ins-";
const createdEmails = [];
let counter = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

function nextEmail() {
  const email = `${EMAIL_PREFIX}${runId}-${String(counter++).padStart(3, "0")}@example.test`;
  createdEmails.push(email);
  return email;
}

async function newUser(label) {
  const name = `${personTag} ${label}`;
  const email = nextEmail();
  const res = await request(app).post("/api/auth/register").send({ name, email, password });
  return { id: res.body.user.id, token: res.body.token, name, email };
}

// An admin: created with Prisma (register never makes admins), then logged in through the API
async function newAdmin(label) {
  const name = `${personTag} ${label}`;
  const email = nextEmail();
  const passwordHash = await bcrypt.hash(password, 4);
  const created = await prisma.user.create({ data: { name, email, passwordHash, role: "admin" } });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return { id: created.id, token: res.body.token, name, email };
}

// Every response body is remembered, so one test can check that none contained a password hash
const bodies = [];
async function get(user, path) {
  const req = request(app).get(path);
  const res = await (user ? req.set({ Authorization: `Bearer ${user.token}` }) : req);
  bodies.push(JSON.stringify(res.body));
  return res;
}

const book = (userId, title, genre, price, status, extra = {}) => ({
  userId,
  title: `${tag} ${title}`,
  author: `Au${runId}`,
  genre,
  price,
  status, // database value: reading | completed | to_read
  ...extra,
});

let alice, bea, cy, dee, eve, fay, gus, admin;
const fa = `Fa${runId}`; // Alice's main genre
const sc = `Sc${runId}`;
const zz = `Zz${runId}`; // a genre Alice does not read

beforeAll(async () => {
  // Remove leftovers of earlier crashed runs, then create this run's users and data
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  alice = await newUser("Alice");
  bea = await newUser("Bea");
  cy = await newUser("Cy");
  dee = await newUser("Dee");
  eve = await newUser("Eve"); // no books at all
  fay = await newUser("Fay"); // exactly 5 books, 3 completed
  gus = await newUser("Gus"); // 4 books
  admin = await newAdmin("Admin");

  await prisma.book.createMany({
    data: [
      // Alice: 5 books, 125.49 in total; "Fa" and "fa" are the same genre; prices 10 and 20 sit on bucket edges
      book(alice.id, "A1", fa, 10, "completed"),
      book(alice.id, "A2", fa.toLowerCase(), 20, "completed"),
      book(alice.id, "A3", fa, 30.5, "reading"),
      book(alice.id, "A4", sc, 59.99, "to_read"),
      book(alice.id, "OwnX", fa, 5, "to_read"),
      // Bea, Cy and Dee own the recommendation candidates (Bea first, so her rows are the oldest)
      book(bea.id, "OWNX", fa, 5, "to_read"), // Alice owns this title (other case): never recommended to her
      book(bea.id, "Rec1", fa, 9.99, "reading"),
      book(bea.id, "Rec1", fa, 9.99, "reading"), // twice: still one owner
      book(bea.id, "Rec2", sc, 14, "completed"),
      book(bea.id, "Far1", zz, 7, "completed"),
      ...[1, 2, 3, 4, 5].map((n) => book(bea.id, `Extra${n}`, zz, 8, "to_read")),
      book(cy.id, "rec1", fa.toLowerCase(), 9.99, "to_read"),
      book(cy.id, "Rec2", sc, 14, "to_read"),
      book(cy.id, "Far1", zz, 7, "to_read"),
      book(dee.id, "REC1", fa, 9.99, "to_read"),
      book(dee.id, "Far1", zz, 7, "to_read"),
      // Fay: 5 books, 3 completed (60%). Gus: 4 books (too few for completionByUser)
      ...["completed", "completed", "completed", "reading", "to_read"].map((s, i) => book(fay.id, `Fay${i}`, `Fy${runId}`, 12, s)),
      ...["completed", "completed", "reading", "to_read"].map((s, i) => book(gus.id, `Gus${i}`, `Gs${runId}`, 12, s)),
    ],
  });
  // One book from three days ago, for the booksPerDay chart
  await prisma.book.create({ data: book(dee.id, "OldBook", zz, 6, "to_read", { createdAt: new Date(Date.now() - 3 * DAY_MS) }) });
}, 60000);

// Deleting the users also deletes their books (cascade)
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

// ---------- pure helpers ----------

describe("insight helpers", () => {
  it("percent gives whole numbers and 0 for an empty total", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 5)).toBe(100);
    expect(percent(0, 0)).toBe(0);
  });

  it("lastDays counts back across a month boundary, oldest first", () => {
    expect(lastDays("2026-03-02", 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(lastDays("2026-10-20", 14)).toHaveLength(14);
    expect(dayKey(new Date("2026-10-20T23:59:59.999Z"))).toBe("2026-10-20");
  });

  it("fillDays always returns the requested number of entries with zeros filled in", () => {
    expect(fillDays([{ day: "2026-03-01", count: 2 }], 3, "2026-03-02")).toEqual([
      { date: "2026-02-28", count: 0 },
      { date: "2026-03-01", count: 2 },
      { date: "2026-03-02", count: 0 },
    ]);
    expect(fillDays([], 14, "2026-03-02")).toHaveLength(14);
  });

  it("mergeGenres merges spellings that differ by case and counts the statuses", () => {
    const rows = [
      { genre: "sci-fi", status: "reading", _count: { _all: 1 }, _sum: { price: 5 } },
      { genre: "Sci-Fi", status: "completed", _count: { _all: 2 }, _sum: { price: 20 } },
      { genre: "Fantasy", status: "to_read", _count: { _all: 1 }, _sum: { price: 7 } },
    ];
    expect(mergeGenres(rows)).toEqual([
      { genre: "Sci-Fi", count: 3, reading: 1, completed: 2, "to-read": 0, sum: 25 },
      { genre: "Fantasy", count: 1, reading: 0, completed: 0, "to-read": 1, sum: 7 },
    ]);
  });

  it("builds the sentences from numbers, with friendly empty cases", () => {
    expect(summarySentence("you", { totalBooks: 0, totalValue: 0, completionRate: 0, topGenres: [] })).toBe(
      "Your library is empty. Add a few books and your insights will appear here.",
    );
    expect(summarySentence("this user", { totalBooks: 0 })).toBe("This user has no books yet.");
    expect(summarySentence("you", { totalBooks: 1, totalValue: 9.5, completionRate: 100, topGenres: [{ genre: "Fantasy" }] })).toBe(
      "You own 1 book with a total value of 9.50 $. 100% are completed, and Fantasy is your top genre.",
    );

    expect(
      adminSentences({
        totalBooks: 10,
        completionRate: 40,
        topGenre: { genre: "Fantasy", count: 5 },
        priciestGenre: { genre: "Sci-Fi", averagePrice: 24.3 },
        averageBooksPerUser: 5,
        totalUsers: 2,
        usersWithoutBooks: 1,
      }),
    ).toEqual([
      "Readers have completed 40% of the books on the platform.",
      "Fantasy is the most common genre (50% of all books), and Sci-Fi has the highest average price among the top genres (24.30 $).",
      "Users own 5 books on average, and 1 user has no books yet.",
    ]);
    expect(adminSentences({ totalBooks: 0, totalUsers: 0, usersWithoutBooks: 0 })).toEqual([
      "There are no books on the platform yet.",
      "There are no genres to compare yet.",
      "There are no users yet.",
    ]);
  });

  it("formats money for sentences with the sign after the number", () => {
    expect(formatMoneyText(364.48)).toBe("364.48 $");
    expect(formatMoneyText(9.5)).toBe("9.50 $");
    expect(formatMoneyText(0)).toBe("0.00 $");
    expect(formatMoneyText("12.3")).toBe("12.30 $");
    expect(formatMoneyText(1).endsWith(` ${CURRENCY_SYMBOL}`)).toBe(true);
  });

  it("puts the sign after every money value in the sentences, and none where there is no money", () => {
    const mine = summarySentence("you", { totalBooks: 26, totalValue: 364.48, completionRate: 58, topGenres: [] });
    expect(mine).toContain("364.48 $");
    expect(mine).not.toMatch(/\$\d/); // never before the number
    expect(summarySentence("this user", { totalBooks: 2, totalValue: 20, completionRate: 50, topGenres: [] })).toContain("20.00 $.");

    const admin = adminSentences({
      totalBooks: 10,
      completionRate: 40,
      topGenre: { genre: "Fantasy", count: 5 },
      priciestGenre: { genre: "Sci-Fi", averagePrice: 24.3 },
      averageBooksPerUser: 5,
      totalUsers: 2,
      usersWithoutBooks: 1,
    });
    expect(admin[1]).toContain("(24.30 $)");
    // Sentences without money get no sign
    expect(admin[0]).not.toContain("$");
    expect(admin[2]).not.toContain("$");
    expect(summarySentence("you", { totalBooks: 0 })).not.toContain("$");
    expect(summarySentence("this user", { totalBooks: 0 })).not.toContain("$");
    for (const sentence of adminSentences({ totalBooks: 0, totalUsers: 0, usersWithoutBooks: 0 })) {
      expect(sentence).not.toContain("$");
    }
  });

  it("builds the recommendation reason", () => {
    expect(recommendationReason(14, "Fantasy", ["fantasy", "scifi"])).toBe("Owned by 14 readers. Fantasy is your top genre.");
    expect(recommendationReason(2, "SciFi", ["fantasy", "scifi"])).toBe("Owned by 2 readers. SciFi is one of your top genres.");
    expect(recommendationReason(1, "Other", [])).toBe("Owned by 1 reader.");
  });
});

// ---------- access ----------

describe("access", () => {
  it("returns 401 without a token", async () => {
    for (const path of [
      "/api/insights/me",
      "/api/insights/recommendations",
      "/api/admin/insights",
      `/api/admin/users/${alice.id}/insights`,
      "/api/admin/stats",
    ]) {
      expect((await get(null, path)).status).toBe(401);
    }
  });

  it("returns 403 for a normal user on the admin routes, and 200 on their own", async () => {
    expect((await get(alice, "/api/admin/insights")).status).toBe(403);
    expect((await get(alice, `/api/admin/users/${bea.id}/insights`)).status).toBe(403);
    expect((await get(alice, "/api/insights/me")).status).toBe(200);
    expect((await get(alice, "/api/insights/recommendations")).status).toBe(200);
  });
});

// ---------- /api/insights/me ----------

describe("GET /api/insights/me", () => {
  it("returns the user's own numbers, equal to direct Prisma queries", async () => {
    const res = await get(alice, "/api/insights/me");
    expect(res.status).toBe(200);
    const body = res.body;

    // Worked out by hand from the books created above
    expect(body.totalBooks).toBe(5);
    expect(body.totalValue).toBe(125.49);
    expect(body.averagePrice).toBe(25.1);
    expect(body.mostExpensive).toBe(59.99);
    expect(body.completionRate).toBe(40);
    expect(body.statusCounts).toEqual({ reading: 1, completed: 2, "to-read": 2 });
    expect(body.topGenres).toEqual([
      { genre: fa, count: 4 }, // Fa and fa merged, capitalised spelling kept
      { genre: sc, count: 1 },
    ]);
    expect(body.summary).toBe(`You own 5 books with a total value of 125.49 $. 40% are completed, and ${fa} is your top genre.`);

    // And the same from the database
    const agg = await prisma.book.aggregate({ where: { userId: alice.id }, _count: { _all: true }, _sum: { price: true }, _max: { price: true } });
    const genres = await prisma.book.groupBy({ by: ["genre"], where: { userId: alice.id }, _count: { _all: true } });
    expect(body.totalBooks).toBe(agg._count._all);
    expect(body.totalValue).toBe(Number(agg._sum.price));
    expect(body.mostExpensive).toBe(Number(agg._max.price));
    expect(body.topGenres).toEqual(topCounts(genres, "genre", 5));
    expect(Number.isInteger(body.completionRate)).toBe(true);
  });

  it("never mixes in other users' data", async () => {
    const text = JSON.stringify((await get(alice, "/api/insights/me")).body);
    expect(text).not.toContain(personTag);
    expect(text).not.toContain("@example.test");
    // Bea owns far more books, but they do not change Alice's numbers
    const beaRes = await get(bea, "/api/insights/me");
    expect(beaRes.body.totalBooks).toBe(await prisma.book.count({ where: { userId: bea.id } }));
    expect(beaRes.body.totalBooks).not.toBe(5);
  });

  it("returns zeros and a friendly sentence for an empty library", async () => {
    const res = await get(eve, "/api/insights/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalBooks: 0,
      totalValue: 0,
      averagePrice: 0,
      mostExpensive: null,
      completionRate: 0,
      statusCounts: { reading: 0, completed: 0, "to-read": 0 },
      topGenres: [],
      summary: "Your library is empty. Add a few books and your insights will appear here.",
    });
  });
});

// ---------- /api/insights/recommendations ----------

describe("GET /api/insights/recommendations", () => {
  // Distinct owners of a title (ignoring case) according to the database
  async function ownersOf(title) {
    const rows = await prisma.book.findMany({ where: { title: { equals: title, mode: "insensitive" } }, select: { userId: true } });
    return new Set(rows.map((r) => r.userId)).size;
  }

  it("recommends books the user does not own, best genre and most owners first", async () => {
    const res = await get(alice, "/api/insights/recommendations");
    expect(res.status).toBe(200);
    const items = res.body.recommendations;

    expect(items.length).toBe(6);
    // Alice's top genres (Fa, Sc) come first: Rec1 has 3 owners, Rec2 has 2
    expect(items[0]).toMatchObject({ title: `${tag} Rec1`, genre: fa, price: 9.99, owners: 3 });
    expect(items[0].reason).toBe(`Owned by 3 readers. ${fa} is your top genre.`);
    expect(items[1]).toMatchObject({ title: `${tag} Rec2`, genre: sc, owners: 2 });
    expect(items[1].reason).toBe(`Owned by 2 readers. ${sc} is one of your top genres.`);

    // Never a title she owns (compared ignoring case), and owners match the database
    const titles = items.map((i) => i.title.toLowerCase());
    expect(titles).not.toContain(`${tag} ownx`.toLowerCase());
    expect(new Set(titles).size).toBe(items.length);
    for (const item of items) expect(item.owners).toBe(await ownersOf(item.title));
    const aliceTitles = (await prisma.book.findMany({ where: { userId: alice.id }, select: { title: true } })).map((b) => b.title.toLowerCase());
    for (const title of titles) expect(aliceTitles).not.toContain(title);
  });

  it("exposes no names, emails or ids", async () => {
    const res = await get(alice, "/api/insights/recommendations");
    for (const item of res.body.recommendations) {
      expect(Object.keys(item).sort()).toEqual(["author", "genre", "owners", "price", "reason", "title"]);
    }
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(personTag);
    expect(text).not.toContain("@example.test");
    expect(text).not.toContain("userId");
  });

  it("works for a user with no books (empty top genres): the most shared titles", async () => {
    const res = await get(eve, "/api/insights/recommendations");
    expect(res.status).toBe(200);
    const items = res.body.recommendations;
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(6);
    for (const item of items) {
      expect(item.owners).toBe(await ownersOf(item.title));
      expect(item.reason).toBe(`Owned by ${item.owners} ${item.owners === 1 ? "reader" : "readers"}.`);
    }
    const owners = items.map((i) => i.owners);
    expect(owners).toEqual([...owners].sort((a, b) => b - a));
  });
});

// ---------- /api/admin/insights ----------

describe("GET /api/admin/insights", () => {
  it("returns numbers equal to direct Prisma queries", async () => {
    const res = await get(admin, "/api/admin/insights");
    expect(res.status).toBe(200);
    const body = res.body;

    const [users, books, completed, noBooks] = await Promise.all([
      prisma.user.count(),
      prisma.book.count(),
      prisma.book.count({ where: { status: "completed" } }),
      prisma.user.count({ where: { books: { none: {} } } }),
    ]);
    expect(body.averageBooksPerUser).toBe(Number((books / users).toFixed(1)));
    expect(body.usersWithoutBooks).toBe(noBooks);
    expect(body.completionRate).toBe(percent(completed, books));
    expect(body.insights).toHaveLength(3);
    for (const sentence of body.insights) expect(typeof sentence).toBe("string");

    // Price buckets: ranges written out here on purpose (10 belongs to "10-20", 20 to "20-30")
    expect(body.priceBuckets.map((b) => b.label)).toEqual(["<10", "10-20", "20-30", "30-50", "50+"]);
    const expected = await Promise.all([
      prisma.book.count({ where: { price: { lt: 10 } } }),
      prisma.book.count({ where: { price: { gte: 10, lt: 20 } } }),
      prisma.book.count({ where: { price: { gte: 20, lt: 30 } } }),
      prisma.book.count({ where: { price: { gte: 30, lt: 50 } } }),
      prisma.book.count({ where: { price: { gte: 50 } } }),
    ]);
    expect(body.priceBuckets.map((b) => b.count)).toEqual(expected);
    expect(expected.reduce((a, b) => a + b, 0)).toBe(books);
  });

  it("returns at most 5 genres, the same ones in all three blocks, with exact counts and averages", async () => {
    const { body } = await get(admin, "/api/admin/insights");
    expect(body.topGenres.length).toBeLessThanOrEqual(5);
    const names = body.topGenres.map((g) => g.genre);
    expect(body.statusByGenre.map((g) => g.genre)).toEqual(names);
    expect(body.averagePriceByGenre.map((g) => g.genre)).toEqual(names);

    for (let i = 0; i < names.length; i++) {
      const where = { genre: { equals: names[i], mode: "insensitive" } };
      const agg = await prisma.book.aggregate({ where, _count: { _all: true }, _avg: { price: true } });
      expect(body.topGenres[i].count).toBe(agg._count._all);
      const s = body.statusByGenre[i];
      expect(s.reading + s.completed + s["to-read"]).toBe(agg._count._all);
      expect(s.completed).toBe(await prisma.book.count({ where: { ...where, status: "completed" } }));
      expect(body.averagePriceByGenre[i].count).toBe(agg._count._all);
      expect(body.averagePriceByGenre[i].averagePrice).toBeCloseTo(Number(agg._avg.price), 1);
    }
  });

  it("lists users with at least 5 books by completion rate, without emails", async () => {
    const { body } = await get(admin, "/api/admin/insights");
    const rows = body.completionByUser;
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.find((r) => r.id === fay.id)).toEqual({ id: fay.id, name: fay.name, books: 5, completed: 3, completionRate: 60 });
    expect(rows.find((r) => r.id === gus.id)).toBeUndefined(); // only 4 books
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["books", "completed", "completionRate", "id", "name"]);
      expect(row.books).toBeGreaterThanOrEqual(5);
    }
    const rates = rows.map((r) => r.completionRate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(JSON.stringify(rows)).not.toContain("@example.test");
  });

  it("lists the 5 most shared titles, checked against the database", async () => {
    const { body } = await get(admin, "/api/admin/insights");
    expect(body.popularTitles.length).toBeLessThanOrEqual(5);
    for (const entry of body.popularTitles) {
      const rows = await prisma.book.findMany({ where: { title: { equals: entry.title, mode: "insensitive" } }, select: { userId: true } });
      expect(entry.owners).toBe(new Set(rows.map((r) => r.userId)).size);
    }
    const owners = body.popularTitles.map((t) => t.owners);
    expect(owners).toEqual([...owners].sort((a, b) => b - a));
  });
});

// ---------- /api/admin/users/:id/insights ----------

describe("GET /api/admin/users/:id/insights", () => {
  it("has the same shape and numbers as that user's own /me", async () => {
    const asAdmin = await get(admin, `/api/admin/users/${alice.id}/insights`);
    const own = await get(alice, "/api/insights/me");
    expect(asAdmin.status).toBe(200);
    expect(Object.keys(asAdmin.body)).toEqual(Object.keys(own.body));
    const { summary: adminSummary, ...adminRest } = asAdmin.body;
    const { summary: ownSummary, ...ownRest } = own.body;
    expect(adminRest).toEqual(ownRest);
    expect(ownSummary.startsWith("You own")).toBe(true);
    expect(adminSummary.startsWith("This user owns")).toBe(true);
  });

  it("works for an empty library and for an admin target", async () => {
    expect((await get(admin, `/api/admin/users/${eve.id}/insights`)).body.summary).toBe("This user has no books yet.");
    expect((await get(admin, `/api/admin/users/${admin.id}/insights`)).status).toBe(200);
  });

  it("returns 400 for a bad id and 404 for an unknown user", async () => {
    for (const bad of ["abc", "0", "-1", "1.5"]) {
      expect((await get(admin, `/api/admin/users/${bad}/insights`)).status).toBe(400);
    }
    const missing = await get(admin, "/api/admin/users/2147483646/insights");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "User not found" });
  });
});

// ---------- /api/admin/stats (new fields) ----------

describe("GET /api/admin/stats new fields", () => {
  it("keeps every old field", async () => {
    const { body } = await get(admin, "/api/admin/stats");
    for (const key of ["totals", "libraryValue", "booksByStatus", "topGenres", "recentUsers", "admins"]) {
      expect(body).toHaveProperty(key);
    }
    expect(Object.keys(body.totals).sort()).toEqual(["admins", "books", "users"]);
  });

  it("returns the weekly counts and the attention numbers", async () => {
    const { body } = await get(admin, "/api/admin/stats");
    expect(body.newUsers7d).toBeGreaterThanOrEqual(createdEmails.length);
    expect(body.newBooks7d).toBeGreaterThanOrEqual(await prisma.book.count({ where: { title: { startsWith: tag }, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } } }));
    expect(body.attention.usersWithoutBooks).toBe(await prisma.user.count({ where: { books: { none: {} } } }));
    expect(body.attention.newUsersLast48h).toBeGreaterThanOrEqual(createdEmails.length);
  });

  it("returns booksPerDay: 14 consecutive days, oldest first, zeros filled, counts equal the database", async () => {
    const todayBefore = dayKey(new Date()); // computed once; a UTC midnight during the test is tolerated
    const { body } = await get(admin, "/api/admin/stats");
    const days = body.booksPerDay;

    expect(days).toHaveLength(14);
    // The last day is today, or the next day if midnight (UTC) passed while the request ran
    const last = days[13].date;
    expect([todayBefore, dayKey(new Date(Date.parse(`${todayBefore}T00:00:00Z`) + DAY_MS))]).toContain(last);
    expect(days.map((d) => d.date)).toEqual(lastDays(last, 14));
    for (const day of days) {
      expect(Object.keys(day).sort()).toEqual(["count", "date"]);
      expect(Number.isInteger(day.count)).toBe(true);
    }
    expect(days.some((d) => d.count === 0)).toBe(true);

    // Each day equals a Prisma count over that UTC day
    for (const day of days) {
      const from = new Date(`${day.date}T00:00:00.000Z`);
      const to = new Date(from.getTime() + DAY_MS);
      expect(day.count).toBe(await prisma.book.count({ where: { createdAt: { gte: from, lt: to } } }));
    }
    // The books created in the test: today's entry and the entry for the backdated book are not empty
    const old = dayKey(new Date(Date.now() - 3 * DAY_MS));
    expect(days.find((d) => d.date === old)?.count ?? 0).toBeGreaterThanOrEqual(1);
    expect(days.at(-1).count + days.at(-2).count).toBeGreaterThanOrEqual(1);
  });

  it("returns the 5 newest books with only the owner's id and name", async () => {
    const { body } = await get(admin, "/api/admin/stats");
    const recent = body.recentBooks;
    expect(recent).toHaveLength(5);
    const expected = await prisma.book.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } });
    expect(recent.map((b) => b.id)).toEqual(expected.map((b) => b.id));
    for (const b of recent) {
      expect(Object.keys(b).sort()).toEqual(["author", "createdAt", "genre", "id", "owner", "title"]);
      expect(Object.keys(b.owner).sort()).toEqual(["id", "name"]);
    }
  });
});

// ---------- every response ----------

describe("responses", () => {
  it("never contain a password hash", () => {
    expect(bodies.length).toBeGreaterThan(10);
    for (const body of bodies) {
      expect(body).not.toContain("passwordHash");
      expect(body).not.toMatch(/\$2[aby]\$/); // bcrypt hashes start with $2a$, $2b$ or $2y$
    }
  });
});
