// Zod schemas for the books API.
// Unknown keys (userId, id, createdAt...) are stripped by Zod, so clients cannot set them.
import { z } from "zod";

export const STATUSES = ["reading", "completed", "to-read"];

// Fields shared by create and update
const fields = {
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long (max 200)"),
  author: z.string().trim().min(1, "Author is required").max(150, "Author is too long (max 150)"),
  genre: z.string().trim().min(1, "Genre is required").max(50, "Genre is too long (max 50)"),
  price: z
    .number("Price must be a number")
    .min(0, "Price cannot be negative")
    .max(99999999.99, "Price is too large")
    .multipleOf(0.01, "Price can have at most 2 decimals"),
  status: z.enum(STATUSES, "Status must be reading, completed or to-read"),
};

// Create: status is optional; the database default ("to-read") applies when it is missing
export const createBookSchema = z.object({ ...fields, status: fields.status.optional() });

// Update: every field optional, but at least one must be sent
export const updateBookSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Send at least one field to update");

// Empty strings in the query count as "not provided"
const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

// Query string of GET /api/books
export const listQuerySchema = z.object({
  genre: optionalText,
  q: optionalText,
  status: z.enum(STATUSES).optional(),
  sort: z.enum(["createdAt", "title", "price"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// :id must be a positive integer that fits a Postgres Int. The label is used in the error message.
export function makeIdParamSchema(label) {
  const message = `${label} id must be a positive integer`;
  return z
    .string()
    .regex(/^[1-9]\d*$/, message)
    .transform(Number)
    .refine((id) => id <= 2147483647, message);
}

export const idParamSchema = makeIdParamSchema("Book");
