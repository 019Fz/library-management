// Prisma 7 config: tells the Prisma CLI where the schema, migrations and seed are.
import "./src/loadEnv.js"; // loads the root .env (and builds DATABASE_URL from POSTGRES_*)
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Run with: npm run seed
    seed: "tsx prisma/seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
