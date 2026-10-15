// Reads auth settings from the environment and fails fast if the secret is missing.
import "dotenv/config";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Set it in backend/.env (see .env.example).");
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
