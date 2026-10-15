import { describe, expect, it } from "vitest";
import { buildPatch, parsePrice, validateBookForm } from "./bookForm.js";

describe("parsePrice", () => {
  it.each([
    ["0", 0],
    ["12.5", 12.5],
    ["12.50", 12.5],
    ["99999999.99", 99999999.99],
    [" 7 ", 7],
  ])("accepts %s", (text, expected) => {
    expect(parsePrice(text)).toBe(expected);
  });

  it.each(["", "-1", "1e3", "12,5", ".5", "5.", "abc", "1.234", "100000000"])("rejects %j", (text) => {
    expect(parsePrice(text)).toBeNull();
  });
});

describe("validateBookForm", () => {
  const valid = { title: "  Dune ", author: "Frank Herbert", genre: " Sci-Fi", price: "12.50", status: "to-read" };

  it("returns a trimmed payload with a numeric price", () => {
    const { errors, book } = validateBookForm(valid);
    expect(errors).toEqual({});
    expect(book).toEqual({ title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", price: 12.5, status: "to-read" });
  });

  it("reports one message per bad field", () => {
    const { errors } = validateBookForm({ title: "  ", author: "a".repeat(151), genre: "g".repeat(51), price: "abc", status: "reading" });
    expect(Object.keys(errors).sort()).toEqual(["author", "genre", "price", "title"]);
  });

  it("accepts the maximum lengths", () => {
    const { errors } = validateBookForm({ ...valid, title: "t".repeat(200), author: "a".repeat(150), genre: "g".repeat(50) });
    expect(errors).toEqual({});
  });
});

describe("buildPatch", () => {
  const original = { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", price: "12.50", status: "to-read" };

  it("is empty when nothing changed (price compared as numbers)", () => {
    expect(buildPatch(original, { ...original, price: 12.5 })).toEqual({});
  });

  it("contains only the changed fields", () => {
    expect(buildPatch(original, { ...original, price: 15, status: "reading" })).toEqual({ price: 15, status: "reading" });
  });
});
