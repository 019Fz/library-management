// Reads auth settings from the environment and fails fast if the secret is missing.
import "./loadEnv.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Set it in the root .env (see .env.example).");
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

const DEFAULT_LLM_TIMEOUT_MS = 10000;

// Settings of the optional LLM translator, or null when it is switched off.
// Read on every call (not once at start-up) so the tests can turn it on and off.
// It is off unless a base URL (http: or https: only) and a model are set. The key is optional (a local Ollama needs none).
export function getLlmConfig() {
  const baseUrl = (process.env.AI_LLM_BASE_URL ?? "").trim();
  const model = (process.env.AI_LLM_MODEL ?? "").trim();
  if (!baseUrl || !model) return null;

  try {
    const { protocol } = new URL(baseUrl);
    if (protocol !== "http:" && protocol !== "https:") return null;
  } catch {
    return null;
  }

  const timeout = Number(process.env.AI_LLM_TIMEOUT_MS);
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    apiKey: (process.env.AI_LLM_API_KEY ?? "").trim() || null,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : DEFAULT_LLM_TIMEOUT_MS,
  };
}
