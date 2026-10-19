import { describe, expect, it } from "vitest";
import { bookListQuery, adminBookListQuery } from "./bookQuery.js";
import { userListQuery } from "./userQuery.js";

const params = (text) => new URLSearchParams(text);

describe("books query", () => {
  it("uses the defaults for an empty URL", () => {
    expect(bookListQuery.readFilters(params(""))).toEqual({
      q: "",
      genre: "",
      status: "",
      sort: "createdAt",
      order: "desc",
      page: 1,
    });
  });

  it("falls back to the defaults for invalid values", () => {
    const filters = bookListQuery.readFilters(params("status=done&sort=owner&order=up&page=0"));
    expect(filters).toMatchObject({ status: "", sort: "createdAt", order: "desc", page: 1 });
    expect(bookListQuery.readFilters(params("page=abc")).page).toBe(1);
    expect(bookListQuery.readFilters(params("page=1.5")).page).toBe(1);
    expect(bookListQuery.readFilters(params("page=1000001")).page).toBe(1);
  });

  it("keeps valid values", () => {
    const filters = bookListQuery.readFilters(params("q=dune&genre=Sci-Fi&status=to-read&sort=price&order=asc&page=3"));
    expect(filters).toEqual({ q: "dune", genre: "Sci-Fi", status: "to-read", sort: "price", order: "asc", page: 3 });
  });

  it("trims q, skips empty filters and always sends sort, order, page and limit", () => {
    const filters = bookListQuery.readFilters(params("q=%20%20dune%20&genre="));
    expect(bookListQuery.toApiQuery(filters)).toBe("q=dune&sort=createdAt&order=desc&page=1&limit=12");
  });
});

describe("admin books query", () => {
  it("accepts userId only as a positive integer", () => {
    const read = (value) => adminBookListQuery.readFilters(params(`userId=${value}`)).userId;
    expect(read("12")).toBe("12");
    for (const bad of ["abc", "0", "-3", "1.5", "007", "2147483648", ""]) expect(read(bad)).toBe("");
  });

  it("sends userId to the API", () => {
    const filters = adminBookListQuery.readFilters(params("userId=7"));
    expect(adminBookListQuery.toApiQuery(filters)).toContain("userId=7");
  });
});

describe("users query", () => {
  it("accepts the user sorts and roles, and falls back otherwise", () => {
    expect(userListQuery.readFilters(params("sort=books&order=asc&role=admin"))).toMatchObject({
      sort: "books",
      order: "asc",
      role: "admin",
    });
    expect(userListQuery.readFilters(params("sort=price&role=root"))).toMatchObject({ sort: "createdAt", role: "" });
  });

  it("uses 10 users per page", () => {
    expect(userListQuery.toApiQuery(userListQuery.readFilters(params("")))).toContain("limit=10");
  });
});
