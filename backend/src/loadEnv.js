// Loads the ONE .env file of the project, which sits in the repository root (next to docker-compose.yml).
// Import this first, before anything reads process.env. It is found from this file's own location,
// so it works no matter which folder a command is started from.
//   - Docker: the image has no .env file (compose passes the variables itself), so nothing is loaded.
//   - Variables that are already set (for example by Docker) are never overwritten.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
dotenv.config({ path: rootEnv, quiet: true });

// On the host the database is reached through the port Docker publishes (localhost).
// DATABASE_URL is built from the same POSTGRES_* variables compose uses, so the password lives in one place.
// A DATABASE_URL that is already set is kept as it is.
const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } = process.env;
if (!process.env.DATABASE_URL && POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DB) {
  const user = encodeURIComponent(POSTGRES_USER);
  const password = encodeURIComponent(POSTGRES_PASSWORD);
  const port = POSTGRES_PORT || "5432";
  process.env.DATABASE_URL = `postgresql://${user}:${password}@localhost:${port}/${POSTGRES_DB}?schema=public`;
}
