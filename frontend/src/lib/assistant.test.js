import { describe, expect, it } from "vitest";
import {
  capMessages,
  chipsToShow,
  DEFAULT_RETRY_SECONDS,
  describeIntent,
  formatCell,
  MAX_MESSAGES,
  parseRetryAfter,
  retrySecondsFrom,
  sourceLabel,
} from "./assistant.js";

describe("describeIntent", () => {
  it("describes list_books with its filters, sort and limit", () => {
    const text = describeIntent("list_books", {
      scope: "mine",
      genre: "Fantasy",
      status: "to-read",
      sort: "price",
      order: "desc",
      limit: 5,
    });
    expect(text).toBe("Listing books (your books only, status: To read, genre: Fantasy, sorted by price, highest first, up to 5)");
  });

  it("describes price limits", () => {
    expect(describeIntent("list_books", { maxPrice: 20 })).toContain("price under");
    expect(describeIntent("list_books", { minPrice: 10 })).toContain("price over");
    expect(describeIntent("list_books", { minPrice: 10, maxPrice: 20 })).toContain("price from");
  });

  it("describes the sort orders for title and date", () => {
    expect(describeIntent("list_books", { sort: "title", order: "asc" })).toContain("title, A to Z");
    expect(describeIntent("list_books", { sort: "createdAt", order: "desc" })).toContain("date added, newest first");
  });

  it("describes every book_stats metric and the author and owner filters", () => {
    expect(describeIntent("book_stats", { metric: "count" })).toBe("Counting books");
    expect(describeIntent("book_stats", { metric: "sum_price" })).toBe("Adding up book prices");
    expect(describeIntent("book_stats", { metric: "avg_price" })).toBe("Average book price");
    expect(describeIntent("book_stats", { metric: "min_price" })).toBe("Lowest book price");
    expect(describeIntent("book_stats", { metric: "max_price" })).toBe("Highest book price");
    expect(describeIntent("book_stats", { metric: "count", author: "Tolkien", ownerName: "Mia" })).toBe(
      "Counting books (owned by Mia, author: Tolkien)",
    );
  });

  it("describes the ranking and breakdown intents", () => {
    expect(describeIntent("top_genres", { scope: "all", limit: 5 })).toBe("Top 5 genres");
    expect(describeIntent("top_authors", { scope: "mine", limit: 3 })).toBe("Top 3 authors (your books only)");
    expect(describeIntent("status_breakdown", { scope: "all" })).toBe("Books by status");
  });

  it("describes the admin intents and unsupported", () => {
    expect(describeIntent("top_owners", { limit: 5 })).toBe("Users with the most books (up to 5)");
    expect(describeIntent("popular_books", { limit: 5 })).toBe("Most popular books (up to 5)");
    expect(describeIntent("count_users", {})).toBe("Counting users");
    expect(describeIntent("unsupported", {})).toBe("Not understood");
  });

  it("does not throw on unknown intents or odd params", () => {
    expect(describeIntent("some_new_intent", {})).toBe("some new intent");
    expect(describeIntent(undefined, undefined)).toBe("Unknown request");
    expect(describeIntent("list_books", null)).toBe("Listing books");
    expect(describeIntent("list_books", { genre: 5, limit: "x", sort: "nope", metric: {} })).toBe("Listing books");
  });
});

describe("sourceLabel", () => {
  it("says AI only for the llm source", () => {
    expect(sourceLabel("llm")).toBe("AI");
    expect(sourceLabel("rules")).toBe("rules");
    expect(sourceLabel(undefined)).toBe("rules");
  });
});

describe("formatCell", () => {
  it("formats prices and counts", () => {
    expect(formatCell(12.5, "price")).toMatch(/12\.50/);
    expect(formatCell("12.5", "price")).toMatch(/12\.50/);
    expect(formatCell(1250, "number")).toBe(new Intl.NumberFormat().format(1250));
  });

  it("turns a status into its label", () => {
    expect(formatCell("to-read", "status")).toBe("To read");
    expect(formatCell("reading", "status")).toBe("Reading");
    expect(formatCell("other", "status")).toBe("other");
  });

  it("shows text as is and empty values as a dash", () => {
    expect(formatCell("Dune", "text")).toBe("Dune");
    expect(formatCell(7, "text")).toBe("7");
    expect(formatCell(null, "text")).toBe("-");
    expect(formatCell(undefined, "price")).toBe("-");
    expect(formatCell("", "number")).toBe("-");
  });

  it("does not turn a bad number into NaN", () => {
    expect(formatCell("abc", "price")).toBe("abc");
    expect(formatCell("abc", "number")).toBe("abc");
  });
});

describe("parseRetryAfter", () => {
  it("reads whole seconds from text or a number", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter(" 45 ")).toBe(45);
    expect(parseRetryAfter(7)).toBe(7);
  });

  it("rounds fractions up", () => {
    expect(parseRetryAfter("2.2")).toBe(3);
  });

  it("uses the default when missing or invalid", () => {
    expect(parseRetryAfter(undefined)).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter(null)).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter("")).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter("soon")).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter("-5")).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter("0")).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT")).toBe(DEFAULT_RETRY_SECONDS);
    expect(parseRetryAfter(NaN)).toBe(DEFAULT_RETRY_SECONDS);
  });

  it("caps very long waits", () => {
    expect(parseRetryAfter("99999")).toBe(300);
  });
});

describe("retrySecondsFrom", () => {
  it("prefers the header", () => {
    expect(retrySecondsFrom("12", "Too many requests. Try again in 40 seconds.")).toBe(12);
  });

  it("reads the message when the header is not readable", () => {
    expect(retrySecondsFrom(undefined, "Too many requests. Try again in 40 seconds.")).toBe(40);
    expect(retrySecondsFrom(undefined, "Try again in 1 second.")).toBe(1);
  });

  it("uses the default when neither helps", () => {
    expect(retrySecondsFrom(undefined, undefined)).toBe(DEFAULT_RETRY_SECONDS);
    expect(retrySecondsFrom(undefined, "Slow down")).toBe(DEFAULT_RETRY_SECONDS);
    expect(retrySecondsFrom("junk", "Try again in 40 seconds.")).toBe(DEFAULT_RETRY_SECONDS);
  });
});

describe("chipsToShow", () => {
  const examples = ["One?", "Two?", "Three?", "Four?", "Five?"];

  it("shows every example when the conversation is empty", () => {
    expect(chipsToShow({ examples, messages: [], busy: false })).toEqual(examples);
  });

  it("shows at most 3 unasked examples once there are messages", () => {
    const messages = [{ role: "user", text: "two?" }, { role: "assistant" }];
    expect(chipsToShow({ examples, messages, busy: false })).toEqual(["One?", "Three?", "Four?"]);
  });

  it("shows nothing while waiting, or without examples", () => {
    expect(chipsToShow({ examples, messages: [], busy: true })).toEqual([]);
    expect(chipsToShow({ examples: [], messages: [], busy: false })).toEqual([]);
    expect(chipsToShow({ examples: undefined, messages: [], busy: false })).toEqual([]);
  });
});

describe("capMessages", () => {
  it("keeps only the newest messages", () => {
    const many = Array.from({ length: MAX_MESSAGES + 10 }, (_, id) => ({ id }));
    const capped = capMessages(many);
    expect(capped).toHaveLength(MAX_MESSAGES);
    expect(capped[0].id).toBe(10);
    expect(capped.at(-1).id).toBe(MAX_MESSAGES + 9);
  });

  it("leaves a short list alone", () => {
    const few = [{ id: 1 }];
    expect(capMessages(few)).toBe(few);
  });
});
