// Zod schema for the body of POST /api/ai/query
import { z } from "zod";

export const MAX_QUESTION_LENGTH = 300;

export const questionSchema = z.object({
  question: z
    .string("Question must be text")
    .trim()
    .min(1, "Question is required")
    .max(MAX_QUESTION_LENGTH, `Question is too long (max ${MAX_QUESTION_LENGTH} characters)`),
});
