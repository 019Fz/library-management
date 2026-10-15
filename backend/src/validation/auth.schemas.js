// Zod schemas for auth request bodies.
// Unknown keys (such as "role") are stripped by Zod, so clients can never set them.
import { z } from "zod";

// Trim and lowercase first, then check it is a valid email
const email = z.string().trim().toLowerCase().pipe(z.email());

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"), // bcrypt ignores anything past 72 bytes
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
