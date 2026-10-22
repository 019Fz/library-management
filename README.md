# Library Management System

A web app where users manage their personal book library, an admin manages all users and books, and an AI assistant answers natural-language questions about the library data. The full task description is in [`docs/SPEC.md`](docs/SPEC.md).

## Features

- **Accounts:** register and log in (JWT, bcrypt-hashed passwords). Two roles: `user` and `admin`.
- **Books:** add, edit, delete, search, filter by genre and status, sort and paginate. Every user only ever sees their own books.
- **Admin:** a dashboard (totals, books added per day, status split, newest users and books), a users page (change roles, delete users) and an all-books page. An admin cannot change the role of or delete their own account.
- **AI Query Agent:** ask questions like "Who owns the most books?", "Which is the most popular book?" or "Show the five most expensive books". A floating chat widget on every page shows the answer as a table, a number or a message.
- **Insights:** reading status, top genres and a "what stands out" summary, plus book recommendations a user can add with one click. Admins also get a platform view and a view of any single user.
- **Tests:** Vitest and Supertest (backend), Vitest (frontend).
- **Docker:** `docker compose up --build` starts the whole stack.

**Stack:** React, Vite, React Router, Axios, Tailwind CSS v4 | Node.js, Express 5, Zod | PostgreSQL 16, Prisma 7 | Docker, nginx.

## Quick start (Docker)

**1. Create a file named `.env` in the repository root** with these four lines:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
JWT_SECRET=
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (or any long random string). The database password must use letters and digits only, because it becomes part of the database URL.

**2. Start everything:**

```
docker compose up --build
```

**3. Open the app:** <http://localhost:(your_port)> (the API health check is <http://localhost:(your_port)/health>). Register an account to start adding books.

The first start takes a few minutes. The database tables are created automatically.

### Create an admin account (optional)

A fresh database has no admin, and registration only creates normal users. In a second terminal, choose your own admin email and password:

```
docker compose exec -e SEED_ADMIN_EMAIL=admin@example.com -e SEED_ADMIN_PASSWORD=your_password backend npm run seed
```

### Stop and reset

```
docker compose down       # stop; the database is kept
docker compose down -v    # stop and DELETE the database
```

### Look inside the database

```
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Then `\dt` lists the tables and `\q` quits. The database port is published on `127.0.0.1:(Your_port)` only, so a desktop client can also connect with the values from your `.env`.

## Environment variables

All settings live in **one `.env` file in the repository root**. It is read by Docker Compose, by the backend when it runs on your computer, and by Vite (only `VITE_` variables reach the browser). It is never committed.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | yes | | Database credentials (password: letters and digits only) |
| `JWT_SECRET` | yes | | Key that signs login tokens. Keep it secret |
| `JWT_EXPIRES_IN` | no | `1d` | How long a login stays valid |
| `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT` | no |  | Ports on your computer |
| `VITE_API_URL` | no | `http://localhost:(your_backend_port)` | Address the browser uses for the API. Baked in at build time, so rebuild after changing it |
| `CORS_ORIGIN` | no | `http://localhost:(your_frontend_port)` | Address the browser opens the app on |
| `SEED`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO`, `DEMO_USER_PASSWORD` | no | off | Optional seeding at container start (see the commands above for the manual way) |
| `AI_LLM_BASE_URL`, `AI_LLM_MODEL`, `AI_LLM_API_KEY`, `AI_LLM_TIMEOUT_MS` | no | off | Optional LLM translator (see below) |


## AI Query Agent

A question never becomes SQL. It is translated into an **intent** (a name from a fixed list plus validated parameters), and the backend runs a fixed, parameterised query for that intent. The answer text and table are built by the backend, never by a model.

1. A **rule-based parser** understands the common questions. This part needs nothing extra.
2. An **optional LLM translator** is tried only when the rules do not understand a question. It receives the question text and the list of intents, never any data, and its answer is validated. Anything invalid becomes "I don't understand that question yet".

Safety rules: normal users are always limited to their own books (taken from the login token, never from the question). Questions about other users (owners, popularity, user counts) are admin-only. Questions are limited to 300 characters, answers to 25 rows, and each user to 30 questions per minute.

**Enable the LLM** (it is off by default; both `AI_LLM_BASE_URL` and `AI_LLM_MODEL` are required). For Ollama running on your computer, add to `.env` and run `docker compose up -d`:

```
AI_LLM_BASE_URL=
AI_LLM_MODEL=
AI_LLM_TIMEOUT_MS=
```
 In the chat widget, an answer's "Understood as" line shows `rules` or `AI`. The first question can be slow while the model loads, so a longer timeout helps.

## Project structure

```
backend/        Express API: src/ (ai, controllers, routes, middleware, validation, lib),
                prisma/ (schema, migrations, seeds), tests/
frontend/       React app: src/ (pages, components, layouts, context, lib, config)
docker/         One Dockerfile (backend and frontend targets), nginx.conf, container start script
docs/           SPEC.md (the task)
docker-compose.yml
```

## Tests

```
cd backend && npm test     # needs the database running (docker compose up -d db)
cd frontend && npm test
```

The backend tests use the real database. They create users whose emails start with `auth-test-` and delete only those, so your own data is untouched. No test calls a real LLM.

## Security notes

- Passwords are hashed with bcrypt, and the password hash is never returned by the API.
- Login tokens are signed JWTs. The role is never accepted from client input, and an admin cannot demote or delete themselves.
- Normal users never see other users' names or emails (not even through recommendations or the assistant).
- Secrets live only in the root `.env`, which is git-ignored and never copied into a Docker image.
- The database is not reachable from the network, only from your own computer.
- `npm audit` reports 4 high-severity warnings in the Prisma CLI's own dependencies. That tool is used for migrations and seeding, not by the API while it handles requests.
