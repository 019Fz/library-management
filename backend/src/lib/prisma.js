// Shared Prisma client. Prisma 7 needs a driver adapter to talk to Postgres.
import "../loadEnv.js"; // the root .env
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

export default prisma;
