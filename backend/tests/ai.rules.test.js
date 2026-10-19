// Unit tests for the rule-based parser, the intent catalog, the answer builder and the rate limiter.
// No database and no network. The order follows the priorities: (a) the spec questions, (b) status and genre,
// (c) price and sorting, (d) statistics, genres, authors and status breakdown, (e) everything else.
import { describe, it, expect } from "vitest";
import { parseQuestion, normalise, parseNumber } from "../src/ai/rules.js";
import { INTENTS, validateIntent, isAdminOnly, examplesFor, MAX_ROWS } from "../src/ai/intents.js";
import { buildAnswer, unsupportedAnswer, adminOnlyAnswer } from "../src/ai/answer.js";
import { createRateLimiter } from "../src/middleware/rateLimit.js";

// Shortcuts
const ask = (question) => parseQuestion(question);
const intentOf = (question) => parseQuestion(question)?.intent ?? null;
const paramsOf = (question) => parseQuestion(question)?.params;

// ---------- (a) the three spec questions ----------
describe("spec questions", () => {
  it("Who owns the most books?", () => {
    expect(ask("Who owns the most books?")).toEqual({ intent: "top_owners", params: {} });
  });

  it("Which is the most popular book?", () => {
    expect(ask("Which is the most popular book?")).toEqual({ intent: "popular_books", params: {} });
  });

  it("Show the five most expensive books.", () => {
    expect(ask("Show the five most expensive books.")).toEqual({
      intent: "list_books",
      params: { sort: "price", order: "desc", limit: 5 },
    });
  });

  it("understands other phrasings of the same questions", () => {
    for (const question of [
      "who has the most books",
      "Which user has the most books?",
      "top owners",
      "top 3 owners",
      "users with the most books",
      "who has the biggest collection",
    ]) {
      expect(intentOf(question), question).toBe("top_owners");
    }
    for (const question of [
      "what is the most popular book",
      "most popular books",
      "which books are the most popular",
      "which book do most people own",
      "popular titles",
      "which is the most owned book",
    ]) {
      expect(intentOf(question), question).toBe("popular_books");
    }
    expect(paramsOf("show 5 most expensive books")).toMatchObject({ sort: "price", order: "desc", limit: 5 });
    expect(paramsOf("list the 3 priciest books")).toMatchObject({ sort: "price", order: "desc", limit: 3 });
    expect(paramsOf("give me the top ten most expensive books")).toMatchObject({ sort: "price", limit: 10 });
  });

  it("does not mistake 'who has the most expensive books' for the owners question", () => {
    expect(intentOf("who has the most expensive books")).not.toBe("top_owners");
  });
});

// ---------- (b) status and genre filters ----------
describe("status and genre filters", () => {
  it("genre from '<genre> books'", () => {
    expect(ask("List my fantasy books")).toEqual({ intent: "list_books", params: { scope: "mine", genre: "fantasy" } });
    expect(paramsOf("list all mystery books")).toEqual({ genre: "mystery" });
    expect(paramsOf("show me sci-fi books")).toEqual({ genre: "sci-fi" });
    expect(paramsOf("show me science fiction books")).toEqual({ genre: "science fiction" });
  });

  it("genre from 'genre X' and 'in the X genre'", () => {
    expect(paramsOf("show books in the sci-fi genre")).toEqual({ genre: "sci-fi" });
    expect(paramsOf("show books with genre fantasy")).toEqual({ genre: "fantasy" });
    expect(paramsOf("list books of the romance genre")).toEqual({ genre: "romance" });
  });

  it("does not take ordinary words for a genre", () => {
    for (const question of ["show the five most expensive books", "show me all books", "list my books", "how many books"]) {
      expect(paramsOf(question)?.genre, question).toBeUndefined();
    }
  });

  it("status completed", () => {
    for (const question of ["show completed books", "list the books I finished", "show books I have read"]) {
      expect(paramsOf(question)?.status, question).toBe("completed");
    }
  });

  it("status reading", () => {
    for (const question of ["books I am reading", "show the books I'm currently reading", "list books in progress"]) {
      expect(paramsOf(question)?.status, question).toBe("reading");
    }
  });

  it("status to-read", () => {
    for (const question of ["list books to read", "show my unread books", "show books I want to read", "list my backlog books"]) {
      expect(paramsOf(question)?.status, question).toBe("to-read");
    }
  });

  it("status and genre together", () => {
    expect(ask("show my completed fantasy books")).toEqual({
      intent: "list_books",
      params: { scope: "mine", status: "completed", genre: "fantasy" },
    });
  });
});

// ---------- (c) price filters and sorting ----------
describe("price filters and sorting", () => {
  it("max price", () => {
    for (const question of ["show books under 20 dollars", "list books below $20", "books cheaper than 20", "list books up to 20", "show books at most 20"]) {
      expect(paramsOf(question)?.maxPrice, question).toBe(20);
    }
  });

  it("min price", () => {
    for (const question of ["list books over $15", "show books above 15", "books costing more than 15", "list books at least 15"]) {
      expect(paramsOf(question)?.minPrice, question).toBe(15);
    }
  });

  it("price range, decimals and number words", () => {
    expect(paramsOf("books between 10 and 30")).toEqual({ minPrice: 10, maxPrice: 30 });
    expect(paramsOf("show books between $30 and $10")).toEqual({ minPrice: 10, maxPrice: 30 });
    expect(paramsOf("list books under 12.50")).toEqual({ maxPrice: 12.5 });
    expect(paramsOf("list books under ten dollars")).toEqual({ maxPrice: 10 });
  });

  it("sorts by price", () => {
    expect(paramsOf("cheapest books")).toEqual({ sort: "price", order: "asc" });
    expect(paramsOf("show the priciest books")).toMatchObject({ sort: "price", order: "desc" });
    expect(paramsOf("list books from the lowest price")).toMatchObject({ sort: "price", order: "asc" });
    expect(ask("show books with the highest price")).toMatchObject({ intent: "list_books", params: { sort: "price", order: "desc" } });
    // ...while a plain question about the price is still a statistic
    expect(intentOf("what is the lowest price")).toBe("book_stats");
    expect(paramsOf("show the most expensive books")).toMatchObject({ sort: "price", order: "desc" });
  });

  it("sorts by date and title", () => {
    expect(paramsOf("show the newest books")).toMatchObject({ sort: "createdAt", order: "desc" });
    expect(paramsOf("list my latest books")).toMatchObject({ sort: "createdAt", order: "desc" });
    expect(paramsOf("show the oldest books")).toMatchObject({ sort: "createdAt", order: "asc" });
    expect(paramsOf("list books alphabetically")).toMatchObject({ sort: "title", order: "asc" });
    expect(paramsOf("list books reverse alphabetical")).toMatchObject({ sort: "title", order: "desc" });
  });

  it("limit with digits and number words, clamped to 25", () => {
    expect(paramsOf("show the 3 cheapest fantasy books")).toEqual({ genre: "fantasy", sort: "price", order: "asc", limit: 3 });
    expect(paramsOf("list 7 books")?.limit).toBe(7);
    expect(paramsOf("show the top ten most expensive books")?.limit).toBe(10);
    expect(paramsOf("show the top 30 most expensive books")?.limit).toBe(MAX_ROWS);
    expect(paramsOf("list books limit 2")?.limit).toBe(2);
  });

  it("a singular superlative means one book", () => {
    expect(paramsOf("what is the most expensive book")).toEqual({ sort: "price", order: "desc", limit: 1 });
    expect(paramsOf("which is the cheapest fantasy book")).toMatchObject({ sort: "price", order: "asc", limit: 1, genre: "fantasy" });
  });

  it("combines filters", () => {
    expect(paramsOf("the five most expensive fantasy books under 50")).toEqual({
      genre: "fantasy",
      maxPrice: 50,
      sort: "price",
      order: "desc",
      limit: 5,
    });
  });
});

// ---------- (d) statistics, genres, authors, status breakdown ----------
describe("book_stats", () => {
  it("count", () => {
    expect(ask("How many books have I completed?")).toEqual({
      intent: "book_stats",
      params: { scope: "mine", status: "completed", metric: "count" },
    });
    expect(ask("how many fantasy books do I have")).toEqual({
      intent: "book_stats",
      params: { scope: "mine", genre: "fantasy", metric: "count" },
    });
    expect(paramsOf("how many books are there")).toEqual({ metric: "count" });
    expect(paramsOf("count my books")).toEqual({ scope: "mine", metric: "count" });
    expect(paramsOf("number of books I have finished")).toMatchObject({ metric: "count", status: "completed" });
    expect(paramsOf("how many books cost more than 20")).toEqual({ metric: "count", minPrice: 20 });
  });

  it("sum of prices", () => {
    expect(ask("What is the total value of my library?")).toEqual({
      intent: "book_stats",
      params: { scope: "mine", metric: "sum_price" },
    });
    for (const question of ["how much are my books worth", "what is my library worth", "total price of all my books", "how much did I spend on books"]) {
      expect(paramsOf(question)?.metric, question).toBe("sum_price");
    }
  });

  it("average, lowest and highest price", () => {
    expect(paramsOf("what is the average price of my books")).toEqual({ scope: "mine", metric: "avg_price" });
    expect(paramsOf("mean price of fantasy books")).toMatchObject({ metric: "avg_price", genre: "fantasy" });
    expect(paramsOf("what is the lowest price")).toEqual({ metric: "min_price" });
    expect(paramsOf("what is the lowest price of my fantasy books")).toEqual({ scope: "mine", metric: "min_price", genre: "fantasy" });
    expect(paramsOf("what is the highest price")).toEqual({ metric: "max_price" });
    expect(paramsOf("highest price among my completed books")).toMatchObject({ metric: "max_price", status: "completed" });
  });
});

describe("top_genres, top_authors and status_breakdown", () => {
  it("top genres", () => {
    expect(ask("What are my top genres?")).toEqual({ intent: "top_genres", params: { scope: "mine" } });
    expect(paramsOf("top 3 genres")).toEqual({ limit: 3 });
    for (const question of ["What is my favourite genre?", "which genre has the most books", "what genres do I read most", "most common genre", "show my genres"]) {
      expect(intentOf(question), question).toBe("top_genres");
    }
  });

  it("a genre inside a list question is not a genre ranking", () => {
    expect(intentOf("show the most expensive books in the fantasy genre")).toBe("list_books");
    expect(intentOf("list books in the fantasy genre sorted by price")).toBe("list_books");
  });

  it("top authors", () => {
    expect(ask("Who are my top authors?")).toEqual({ intent: "top_authors", params: { scope: "mine" } });
    expect(paramsOf("top 5 authors")).toEqual({ limit: 5 });
    for (const question of ["Which author has the most books?", "who is my favorite author", "most common author", "top writers"]) {
      expect(intentOf(question), question).toBe("top_authors");
    }
  });

  it("status breakdown", () => {
    expect(ask("Show my books by status")).toEqual({ intent: "status_breakdown", params: { scope: "mine" } });
    for (const question of ["break down my books by status", "status breakdown", "how are my books split", "books per status", "give me a breakdown"]) {
      expect(intentOf(question), question).toBe("status_breakdown");
    }
  });
});

// ---------- (e) everything else ----------
describe("count_users", () => {
  it("is recognised in several phrasings", () => {
    for (const question of ["How many users are there?", "how many people are registered", "number of users", "total users", "user count", "how many members do we have"]) {
      expect(ask(question), question).toEqual({ intent: "count_users", params: {} });
    }
  });
});

describe("my versus all", () => {
  it("first person means mine", () => {
    for (const question of ["list my books", "show books I own", "how many books do I have"]) {
      expect(paramsOf(question)?.scope, question).toBe("mine");
    }
  });

  it("'show me' is only polite", () => {
    expect(paramsOf("show me the five most expensive books")?.scope).toBeUndefined();
  });

  it("everyone means all", () => {
    expect(paramsOf("list everyone's books")?.scope).toBe("all");
    expect(paramsOf("show all users books")?.scope).toBe("all");
  });
});

describe("author and owner filters", () => {
  it("author", () => {
    expect(paramsOf("show books by Tolkien")).toEqual({ author: "Tolkien" });
    expect(paramsOf("list books written by Jane Austen under 20")).toEqual({ author: "Jane Austen", maxPrice: 20 });
    expect(paramsOf("how many books by Tolkien do I have")).toEqual({ scope: "mine", author: "Tolkien", metric: "count" });
    expect(paramsOf("show books by price")?.author).toBeUndefined();
  });

  it("owner name (for admins)", () => {
    expect(paramsOf("show books owned by Mia")).toEqual({ ownerName: "Mia" });
    expect(paramsOf("list the cheapest books belonging to Mia Carter")).toMatchObject({ ownerName: "Mia Carter", sort: "price", order: "asc" });
    expect(paramsOf("how many books are owned by Noah")).toMatchObject({ ownerName: "Noah", metric: "count" });
  });

  it("'owned by me' just means mine", () => {
    const params = paramsOf("show books owned by me");
    expect(params.scope).toBe("mine");
    expect(params.ownerName).toBeUndefined();
  });
});

describe("text handling", () => {
  it("ignores case, punctuation and extra spaces", () => {
    const expected = ask("Show the five most expensive books");
    for (const question of ["SHOW THE FIVE MOST EXPENSIVE BOOKS!!!", "  show   the five most   expensive books ?? ", "show, the five most expensive books."]) {
      expect(ask(question), question).toEqual(expected);
    }
  });

  it("understands digits and number words", () => {
    expect(parseNumber("five")).toBe(5);
    expect(parseNumber("TEN")).toBe(10);
    expect(parseNumber("12.5")).toBe(12.5);
    expect(parseNumber("eleven")).toBeNull();
    expect(paramsOf("show the 5 most expensive books")).toEqual(paramsOf("show the five most expensive books"));
  });

  it("normalise keeps names and decimals but drops other punctuation", () => {
    expect(normalise("Who's Mia O'Brien?! $12.50").raw).toBe("Who's Mia O'Brien $12.50");
    expect(normalise("'; DROP TABLE books; --").lower).toBe("drop table books");
  });

  it("returns null when nothing matches", () => {
    for (const question of [
      "",
      "   ",
      "hello",
      "what is the weather today",
      "tell me a joke",
      "who is the president",
      "show me everything",
      "books",
      "'; DROP TABLE books; --",
      "DROP TABLE users",
      "1; SELECT * FROM users",
      "<script>alert(1)</script>",
    ]) {
      expect(ask(question), JSON.stringify(question)).toBeNull();
    }
  });

  it("copes with odd input types and very long text", () => {
    expect(ask(undefined)).toBeNull();
    expect(ask(null)).toBeNull();
    expect(ask(12345)).toBeNull();
    expect(ask("a ".repeat(5000))).toBeNull();
  });
});

describe("examples", () => {
  it("every example is understood, with an intent that fits the role", () => {
    for (const question of examplesFor("user")) {
      const parsed = ask(question);
      expect(parsed, question).not.toBeNull();
      expect(isAdminOnly(parsed.intent), question).toBe(false);
      expect(validateIntent(parsed.intent, parsed.params).ok, question).toBe(true);
    }
    for (const question of examplesFor("admin")) {
      const parsed = ask(question);
      expect(parsed, question).not.toBeNull();
      expect(validateIntent(parsed.intent, parsed.params).ok, question).toBe(true);
    }
  });

  it("admins get the admin examples and the user examples", () => {
    const admin = examplesFor("admin");
    expect(admin).toContain("Who owns the most books?");
    expect(admin).toContain("Which is the most popular book?");
    expect(admin).toContain("Show the five most expensive books");
    expect(examplesFor("user")).not.toContain("Who owns the most books?");
  });
});

// ---------- intents.js ----------
describe("intent catalog", () => {
  it("has the final intent names, and the admin-only flags", () => {
    expect(Object.keys(INTENTS).sort()).toEqual(
      ["book_stats", "count_users", "list_books", "popular_books", "status_breakdown", "top_authors", "top_genres", "top_owners", "unsupported"],
    );
    for (const name of ["top_owners", "popular_books", "count_users"]) expect(isAdminOnly(name)).toBe(true);
    for (const name of ["list_books", "book_stats", "top_genres", "top_authors", "status_breakdown", "unsupported"]) {
      expect(isAdminOnly(name)).toBe(false);
    }
  });

  it("fills in defaults", () => {
    expect(validateIntent("list_books", {})).toEqual({
      ok: true,
      data: { scope: "all", sort: "createdAt", order: "desc", limit: 5 },
    });
    expect(validateIntent("book_stats", {}).data.metric).toBe("count");
    expect(validateIntent("top_genres", {}).data).toEqual({ scope: "all", limit: 5 });
  });

  it("rejects invalid parameters", () => {
    expect(validateIntent("list_books", { limit: 26 }).ok).toBe(false);
    expect(validateIntent("list_books", { limit: 0 }).ok).toBe(false);
    expect(validateIntent("list_books", { sort: "owner" }).ok).toBe(false);
    expect(validateIntent("list_books", { status: "to_read" }).ok).toBe(false);
    expect(validateIntent("list_books", { minPrice: 30, maxPrice: 10 }).ok).toBe(false);
    expect(validateIntent("list_books", { minPrice: -1 }).ok).toBe(false);
    expect(validateIntent("list_books", { genre: "x".repeat(51) }).ok).toBe(false);
    expect(validateIntent("book_stats", { metric: "median" }).ok).toBe(false);
    expect(validateIntent("top_owners", { limit: 100 }).ok).toBe(false);
  });

  it("rejects unknown intents, including names from Object.prototype", () => {
    for (const name of ["drop_table", "constructor", "__proto__", "toString", undefined]) {
      expect(validateIntent(name, {}).ok, String(name)).toBe(false);
      expect(isAdminOnly(name)).toBe(false);
    }
  });

  it("strips keys it does not know, such as a userId", () => {
    const result = validateIntent("list_books", { userId: 1, id: 2, genre: "fantasy" });
    expect(result.ok).toBe(true);
    expect(result.data).not.toHaveProperty("userId");
    expect(result.data).not.toHaveProperty("id");
  });
});

// ---------- answer.js ----------
describe("answer builder", () => {
  const user = { id: 1, role: "user" };

  it("never returns more than 25 rows", () => {
    const books = Array.from({ length: 40 }, (_, index) => ({
      id: index,
      title: `Book ${index}`,
      author: "A",
      genre: "G",
      status: "reading",
      price: 1,
    }));
    const answer = buildAnswer("list_books", { sort: "price", order: "desc", limit: 25 }, { books, total: 40, showOwner: false }, user);
    expect(answer.rows).toHaveLength(25);
    expect(answer.type).toBe("table");
  });

  it("adds an Owner column only when owners are shown", () => {
    const base = { sort: "price", order: "desc", limit: 5 };
    const row = { id: 1, title: "T", author: "A", genre: "G", status: "reading", price: 2, owner: "Mia" };
    const withOwner = buildAnswer("list_books", base, { books: [row], total: 1, showOwner: true }, { id: 1, role: "admin" });
    const without = buildAnswer("list_books", base, { books: [row], total: 1, showOwner: false }, user);
    expect(withOwner.columns.map((c) => c.key)).toContain("owner");
    expect(without.columns.map((c) => c.key)).not.toContain("owner");
  });

  it("builds number answers with a numeric value", () => {
    const answer = buildAnswer("book_stats", { metric: "sum_price" }, { metric: "sum_price", value: 245.5, count: 4 }, user);
    expect(answer).toMatchObject({ type: "number", value: 245.5, format: "price" });
    expect(answer.summary).toContain("245.50");
  });

  it("answers 'no books' for an average of nothing with a message", () => {
    const answer = buildAnswer("book_stats", { metric: "avg_price" }, { metric: "avg_price", value: null, count: 0 }, user);
    expect(answer.type).toBe("message");
  });

  it("status breakdown always lists the three statuses with API names", () => {
    const answer = buildAnswer("status_breakdown", {}, { counts: { reading: 0, completed: 2, "to-read": 1 }, total: 3 }, user);
    expect(answer.rows.map((row) => row.status)).toEqual(["reading", "completed", "to-read"]);
    expect(JSON.stringify(answer)).not.toContain("to_read");
  });

  it("friendly messages carry suggestions for the role", () => {
    const unsupported = unsupportedAnswer("user");
    expect(unsupported).toMatchObject({ type: "message", title: "I can't answer that" });
    expect(unsupported.suggestions).toEqual(examplesFor("user"));

    const blocked = adminOnlyAnswer("user");
    expect(blocked.type).toBe("message");
    expect(blocked.suggestions).not.toContain("Who owns the most books?");
  });
});

// ---------- rate limiter ----------
describe("rate limiter", () => {
  // Minimal fake request/response objects
  function call(limiter, userId) {
    const res = { headers: {}, statusCode: 200, body: null };
    res.set = (name, value) => {
      res.headers[name] = value;
      return res;
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.body = body;
      return res;
    };
    let passed = false;
    limiter({ user: { id: userId } }, res, () => {
      passed = true;
    });
    return { res, passed };
  }

  it("lets `limit` requests through, then answers 429 with Retry-After", () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60000, now: () => time });

    for (let i = 0; i < 3; i += 1) expect(call(limiter, 1).passed).toBe(true);
    time = 20000;
    const blocked = call(limiter, 1);
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.headers["Retry-After"]).toBe("40");
    expect(blocked.res.body.error).toMatch(/Too many requests/);
  });

  it("counts each user separately and starts a new window after the time is up", () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => time });

    expect(call(limiter, 1).passed).toBe(true);
    expect(call(limiter, 1).passed).toBe(false);
    expect(call(limiter, 2).passed).toBe(true); // another user
    time = 1000;
    expect(call(limiter, 1).passed).toBe(true); // new window
  });
});
