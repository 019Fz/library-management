// Zod schemas for the admin API. Invalid query values are rejected with a 400.
import { z } from "zod";
import { listQuerySchema, makeIdParamSchema } from "./book.schemas.js";

export const ROLES = ["user", "admin"];

// Empty strings in the query count as "not provided"
const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

// Query string of GET /api/admin/users
export const userListQuerySchema = z.object({
  q: optionalText,
  role: z.enum(ROLES).optional(),
  sort: z.enum(["createdAt", "name", "email", "books"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Body of PATCH /api/admin/users/:id (any other key is stripped)
export const updateUserSchema = z.object({
  role: z.enum(ROLES, "Role must be user or admin"),
});

// Query string of GET /api/admin/books: the user books filters plus userId
export const adminBookListQuerySchema = listQuerySchema.extend({
  userId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(2147483647).optional(),
  ),
});

export const userIdParamSchema = makeIdParamSchema("User");
