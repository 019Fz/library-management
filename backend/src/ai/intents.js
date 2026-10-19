// The intent catalog: the only things the assistant can do. A question becomes one of these names
// plus parameters, validated here with Zod. Nothing from the question is ever used as SQL.
// adminOnly = who may use it. Unknown keys in the parameters are stripped by Zod.
import { z } from "zod";
import { STATUSES } from "../validation/book.schemas.js";

export const MAX_ROWS = 25;

const text = (max) => z.string().trim().min(1).max(max);
const price = z.number().min(0).max(99999999.99);
const limit = z.number().int().min(1).max(MAX_ROWS).default(5);
// mine = the caller's own books; all = everyone's (only admins get "all": normal users are always scoped)
const scope = z.enum(["mine", "all"]).default("all");

// Filters shared by list_books and book_stats. ownerName is for admins only (checked by the controller).
const bookFilters = {
  scope,
  genre: text(50).optional(),
  status: z.enum(STATUSES).optional(),
  author: text(150).optional(),
  minPrice: price.optional(),
  maxPrice: price.optional(),
  ownerName: text(100).optional(),
};

const priceRangeIsValid = (data) =>
  data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice;
const PRICE_RANGE_MESSAGE = "minPrice cannot be greater than maxPrice";

export const INTENTS = {
  list_books: {
    description: "List books, optionally filtered and sorted (for example the most expensive ones)",
    adminOnly: false,
    schema: z
      .object({
        ...bookFilters,
        sort: z.enum(["price", "title", "createdAt"]).default("createdAt"),
        order: z.enum(["asc", "desc"]).default("desc"),
        limit,
      })
      .refine(priceRangeIsValid, PRICE_RANGE_MESSAGE),
  },
  book_stats: {
    description: "A number about books: how many, total value, average, lowest or highest price",
    adminOnly: false,
    schema: z
      .object({
        ...bookFilters,
        metric: z.enum(["count", "sum_price", "avg_price", "min_price", "max_price"]).default("count"),
      })
      .refine(priceRangeIsValid, PRICE_RANGE_MESSAGE),
  },
  top_genres: {
    description: "Genres ranked by number of books",
    adminOnly: false,
    schema: z.object({ scope, limit }),
  },
  top_authors: {
    description: "Authors ranked by number of books",
    adminOnly: false,
    schema: z.object({ scope, limit }),
  },
  status_breakdown: {
    description: "How many books are reading, completed and to-read",
    adminOnly: false,
    schema: z.object({ scope }),
  },
  top_owners: {
    description: "Users ranked by the number of books they own",
    adminOnly: true,
    schema: z.object({ limit }),
  },
  popular_books: {
    description: "Titles ranked by how many different users own them (case ignored)",
    adminOnly: true,
    schema: z.object({ limit }),
  },
  count_users: {
    description: "How many users are registered",
    adminOnly: true,
    schema: z.object({}),
  },
  unsupported: {
    description: "Anything else",
    adminOnly: false,
    schema: z.object({}),
  },
};

// Checks parameters against an intent's schema: { ok: true, data } (defaults filled in) or { ok: false }
export function validateIntent(name, params) {
  const intent = Object.hasOwn(INTENTS, name) ? INTENTS[name] : null;
  if (!intent) return { ok: false };
  const result = intent.schema.safeParse(params ?? {});
  return result.success ? { ok: true, data: result.data } : { ok: false };
}

export function isAdminOnly(name) {
  return Object.hasOwn(INTENTS, name) && INTENTS[name].adminOnly;
}

// Example questions shown to people (and used in "I can't answer that" messages). Every one is parsed in the tests.
const USER_EXAMPLES = [
  "Show the five most expensive books",
  "List my fantasy books",
  "How many books have I completed?",
  "What is the total value of my library?",
  "What are my top genres?",
  "Who are my top authors?",
  "Show my books by status",
];

const ADMIN_EXAMPLES = [
  "Who owns the most books?",
  "Which is the most popular book?",
  "How many users are there?",
];

export function examplesFor(role) {
  return role === "admin" ? [...ADMIN_EXAMPLES, ...USER_EXAMPLES] : [...USER_EXAMPLES];
}
