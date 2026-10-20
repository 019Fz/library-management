// AI Query Agent endpoints. The flow for a question:
//   text -> rules.js (intent + params) -> intents.js (validate) -> permission check
//        (if the rules give up and an LLM is configured: llm.js asks it for the same intent + params)
//        -> executor.js (fixed query, scoped by the token user) -> answer.js (table / number / message)
// No question text is ever logged.
import { parse } from "../lib/bookHelpers.js";
import { questionSchema } from "../validation/ai.schemas.js";
import { parseQuestion } from "../ai/rules.js";
import { validateIntent, isAdminOnly, examplesFor } from "../ai/intents.js";
import { runIntent } from "../ai/executor.js";
import { translateWithLlm } from "../ai/llm.js";
import { getLlmConfig } from "../config.js";
import { llmAllowed } from "../middleware/rateLimit.js";
import { buildAnswer, unsupportedAnswer, adminOnlyAnswer } from "../ai/answer.js";

export async function askQuestion(req, res) {
  const data = parse(questionSchema, req.body, res);
  if (!data) return;

  const { question } = data;
  const user = req.user;
  const isAdmin = user.role === "admin";

  // 1. Understand the question. Anything the rules do not know, or with invalid parameters, is "unsupported".
  let intent = "unsupported";
  let params = {};
  let source = "rules";
  const parsed = parseQuestion(question);
  if (parsed) {
    const checked = validateIntent(parsed.intent, parsed.params);
    if (checked.ok) {
      intent = parsed.intent;
      params = checked.data;
    }
  } else if (getLlmConfig() && llmAllowed(user.id)) {
    // The rules did not understand it: ask the optional LLM (its answer is already validated, and goes
    // through the same permission check, executor and answer code below). Over the LLM limit -> unsupported.
    const translated = await translateWithLlm(question, { role: user.role });
    if (translated) {
      intent = translated.intent;
      params = translated.params;
      source = "llm";
    }
  }
  // Normal users are always scoped to their own books; show that in what we echo back
  if (!isAdmin && "scope" in params) params = { ...params, scope: "mine" };

  const reply = (answer) => res.json({ question, understood: { intent, params, source }, answer });

  // 2. Permissions. Admin-only intents, and questions about another user's books, are not run for normal users.
  if (intent === "unsupported") return reply(unsupportedAnswer(user.role));
  if (!isAdmin && (isAdminOnly(intent) || params.ownerName)) return reply(adminOnlyAnswer(user.role));

  // 3. Run the fixed query and build the answer. On failure only a fixed message and the error code
  // are logged (database errors can contain the query values).
  let result;
  try {
    result = await runIntent(intent, params, user);
  } catch (err) {
    console.error("AI query failed:", err.code ?? err.name);
    return res.status(500).json({ error: "The question could not be answered. Please try again." });
  }
  reply(buildAnswer(intent, params, result, user));
}

export function listExamples(req, res) {
  res.json({ examples: examplesFor(req.user.role) });
}
