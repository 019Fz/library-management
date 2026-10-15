# Library Management System

Users manage their personal books, an admin manages all users and books, and an AI Query Agent answers natural-language questions about the library data (built in a later phase). See `docs/SPEC.md` for the full spec.

**Stack:** React + Vite + Tailwind CSS (frontend), Node.js + Express (backend), PostgreSQL + Prisma 7 (database), Docker.

## Ports
| Service  | Port |
|----------|------|
| Backend  | 5000 |
| Frontend | 5173 |
| Postgres | 5432 |

## Prerequisites
- Node.js 22+ (developed on 24)
- Docker Desktop

## Setup

1. **Environment files.** Copy each example and edit the values:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   The user, password and database in `backend/.env` (`DATABASE_URL`) must match the root `.env`.

2. **Start Postgres:**
   ```bash
   docker compose up -d
   docker compose ps        # wait until the db shows "healthy"
   ```

3. **Backend:**
   ```bash
   cd backend
   npm install
   npx prisma migrate dev   # create tables
   npx prisma generate      # generate the Prisma client
   npm run seed             # admin user + sample books (safe to re-run)
   npm run dev              # http://localhost:5000/health
   ```

4. **Frontend** (in a second terminal):
   ```bash
   cd frontend
   npm install
   npm run dev              # http://localhost:5173
   ```

## Environment variables (backend/.env)
| Variable | Meaning |
|---|---|
| `PORT` | API port (default 5000) |
| `CORS_ORIGIN` | Allowed frontend origin |
| `DATABASE_URL` | Postgres connection string (must match the root `.env`) |
| `JWT_SECRET` | **Required.** Long random string used to sign tokens. The app will not start without it. |
| `JWT_EXPIRES_IN` | Token lifetime (default `1d`) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Used only by the seed script |

Generate a secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Auth API
Protected routes need the header `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | no | Body: `name`, `email`, `password` (8-72 chars). Always creates a `user` (any `role` in the body is ignored). Returns `201 { user, token }`. `409` if the email exists. |
| POST | `/api/auth/login` | no | Body: `email`, `password`. Returns `200 { user, token }`. `401 "Invalid email or password"` for a wrong email or password. |
| GET | `/api/auth/me` | yes | Returns `{ user }` for the token owner. `401` if the token is missing or invalid. |

Responses never include `passwordHash`. Validation errors return `400` with a `details` list.

## Tests
Backend tests use Vitest + Supertest and run against the real database, so Postgres must be running and `JWT_SECRET` must be set:
```bash
cd backend
npm test
```
Tests create users with `auth-test-...@example.test` emails and delete only those.

## Seeded admin account
Email and password come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `backend/.env`. Change them before using this anywhere real.

## Project layout
```
backend/    Express API, Prisma schema, migrations, seed
frontend/   React app
docs/       Project spec
docker-compose.yml   Postgres 16
```

## Notes
- Never commit `.env` files. Keep the `.env.example` files up to date.
- Prisma 7 does not run `generate` after `migrate dev`, so run `npx prisma generate` yourself.
