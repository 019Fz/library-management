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

1. **Start Postgres:**
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

## Books API
All routes need `Authorization: Bearer <token>` and only ever see the logged-in user's own books. A missing book and another user's book both return `404 {"error":"Book not found"}`. An invalid `:id` (not a positive integer) returns `400`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/books` | Create a book. Returns `201` with the book. The owner is always the caller; any `userId` in the body is ignored. |
| GET | `/api/books` | List your books (see query parameters). Returns `{ books, page, limit, total }`. |
| GET | `/api/books/:id` | Get one book. |
| PATCH | `/api/books/:id` | Partial update. Send at least one field. The owner cannot be changed. |
| DELETE | `/api/books/:id` | Delete a book. Returns `204`. |

**Book fields:** `title` (max 200), `author` (max 150), `genre` (max 50), `price` (JSON number, 0 to 99999999.99, at most 2 decimals), `status` (`reading`, `completed` or `to-read`; default `to-read`).

**List query parameters:**

| Param | Values | Default |
|---|---|---|
| `genre` | exact match, case-insensitive | none |
| `status` | `reading`, `completed`, `to-read` | none |
| `q` | case-insensitive text found in title or author | none |
| `sort` | `createdAt`, `title`, `price` | `createdAt` |
| `order` | `asc`, `desc` | `desc` |
| `page` | integer >= 1 | `1` |
| `limit` | integer 1 to 50 | `10` |

Invalid query values return `400`.

## Tests
Backend tests use Vitest + Supertest and run against the real database, so Postgres must be running and `JWT_SECRET` must be set:
```bash
cd backend
npm test
```
Tests create users with `auth-test-...@example.test` emails and delete only those.

## Frontend
**Environment variable** (`frontend/.env`, copied from `frontend/.env.example`):

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Base URL of the backend API, e.g. `http://localhost:5000`. Restart `npm run dev` after changing it. |

**How auth works in the UI**
- `/register` and `/login` call the auth API. The returned token is stored in `localStorage` (key `token`) and sent as `Authorization: Bearer <token>` on every request.
- On page load, if a token is stored, the app calls `GET /api/auth/me` to restore the user. If that fails the token is cleared.
- `/books` is protected: logged-out visitors are redirected to `/login`. Logged-in users who open `/login` or `/register` are redirected to `/books`.
- If the API answers `401` for any other request (for example an expired token), the token is cleared and the user is sent to `/login`. A `401` on the login or register form is shown as an error message instead.
- Logout clears the token. Unknown URLs show a "Page not found" page.
- `/dashboard` and `/users` are admin-only: other users are redirected to `/books` (the backend is the real check). Both are "Coming soon" placeholders, and so is the content of `/books` for now.

**Frontend structure** (`frontend/src`)

| Folder | What is in it |
|---|---|
| `api/` | Axios client, token storage, 401 handling |
| `context/` | `AuthContext.jsx` (provider), `auth-context.js`, `useAuth.js` |
| `components/ui/` | Shared building blocks: `Button`, `Card`, `Badge`, `FormField`, `ErrorBox`, `Skeleton`, `EmptyState`, `Logo`, `Icon` |
| `components/guards/` | `ProtectedRoute`, `GuestRoute`, `AdminRoute` |
| `components/` | `Sidebar`, `TopBar`, `AuthSplit` (shared login/register layout) |
| `layouts/` | `GuestLayout` (logged-out pages) and `AppLayout` (sidebar + top bar for logged-in pages) |
| `config/` | `app.js` (app name) and `nav.js` (sidebar links and which roles see them) |
| `pages/` | One file per page |
| `lib/` | Small helpers (form checks, page title hook) |

**Changing the theme:** all colors, the font and the corner radius are tokens in the `@theme` block at the top of `frontend/src/index.css`. Components only use token classes such as `bg-card`, `text-ink`, `bg-accent` or `rounded-card`, so editing a value there changes the whole app. Token groups: sidebar, surface/text, accent (also used for the keyboard focus ring), book status colors, danger, radius. To rename the app, edit `APP_NAME` in `frontend/src/config/app.js`. To add a sidebar link, add an entry to `frontend/src/config/nav.js`.


## Project layout
```
backend/    Express API, Prisma schema, migrations, seed
frontend/   React app
docs/       Project spec
docker-compose.yml   Postgres 16
```
