# NEXUS Local Setup Guide

This guide walks through running NEXUS locally with the live backend backend.
It does not create, read, or expose any secret credentials. All secret values
must come from you (the developer) via local `.env` / `.env.local` files which
are gitignored and must never be committed.

## Prerequisites

- Node.js >= 20.19.0 (see `server/package.json` `engines`)
- Docker (for the local PostgreSQL database)
- `npm` (root workspace) — installs both the frontend and `server/` dependencies

## Ports

| Service | Port | Default URL |
|---------|------|-------------|
| Frontend (Next.js) | 3000 | http://localhost:3000 |
| Backend (Express + Socket.IO) | 4000 | http://localhost:4000 |
| PostgreSQL (Docker) | 54329 | localhost:54329 (mapped to container 5432) |

The frontend dev server runs on port 3000 by default (`next dev`). The backend
API runs on port 4000 (`PORT=4000` in `server/.env.example`).

## 1. Start the Database (Docker)

A PostgreSQL 17 container named `nexus-postgres` should already be running:

```bash
docker ps --filter "name=nexus-postgres"
```

Expected output: a running container mapping `0.0.0.0:54329->5432/tcp`.

If it is not running, start it:

```bash
docker start nexus-postgres
```

Or create it from scratch:

```bash
docker run --name nexus-postgres -e POSTGRES_PASSWORD=postgres -p 54329:5432 -d postgres:17-alpine
```

The database name used by the backend is `nexus_dev` (see
`server/.env.example` `DATABASE_URL`). Tests use `nexus_test`.

## 2. Backend Setup (`server/`)

### Step 2a — Create `server/.env`

Copy the example file:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` and fill in any values you need. The example already
contains working local defaults:

```
DATABASE_URL=postgres://postgres:postgres@localhost:54329/nexus_dev
PORT=4000
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
SESSION_COOKIE_SAMESITE=lax
SESSION_TTL_DAYS=30
APP_BASE_URL=http://localhost:3000
DEMO_PASSWORD=nexus-demo-2026
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54329/nexus_test
```

**Do not commit `server/.env`.** It is gitignored (`server/.gitignore`
contains `.env*`). The values above are the example defaults — replace them
with your own if needed.

### Step 2b — Install backend dependencies

```bash
cd server
npm install
```

### Step 2c — Run migrations

```bash
npm run db:migrate
```

This applies all SQL files in `server/migrations/` (0001 through 0010) in
order, inside transactions, recording each in `schema_migrations`.

Check status:

```bash
npm run db:status
```

### Step 2d — Seed demo data

```bash
npm run db:seed
```

This seeds 3 workspaces, 8 members, 9 projects, 46 tasks, subtasks/comments/
attachments, events, conversations, notifications and an activity feed.
All demo users share one predictable password configured by `DEMO_PASSWORD`
in `server/.env`. The script refuses to run when `NODE_ENV=production`.

Re-seed from scratch:

```bash
npm run db:seed -- --fresh
```

Or reset the schema entirely:

```bash
npm run db:reset
```

### Step 2e — Start the backend

```bash
cd server
npm run dev        # http://localhost:4000
```

or build and start:

```bash
cd server
npm run build
npm start          # http://localhost:4000
```

Verify the backend is up:

```bash
curl http://localhost:4000/readyz
# expected: {"data":{"status":"ok","database":"up"}}
```

## 3. Frontend Setup (root)

### Step 3a — Install frontend dependencies

```bash
npm install
```

### Step 3b — Create ` .env.local` (optional — for live backend mode)

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set:

```
NEXT_PUBLIC_NEXUS_API_URL=http://localhost:4000
```

**Without this variable**, the app runs as the fully local demo (seeded data,
state in `localStorage`) — no backend, no auth, no email delivery.

**With this variable set**, the Messages module moves onto the live backend:
REST for threads/messages, Socket.IO for presence, unread receipts and typing
indicators, signed in against a seeded demo account. Everything else stays
local until later phases.

**.env.local is gitignored** — never commit it.

### Step 3c — Start the frontend

```bash
npm run dev        # http://localhost:3000
```

or build and start:

```bash
npm run build
npm start          # http://localhost:3000
```

## 4. Demo / Test Accounts

All demo users share the same password, configured by `DEMO_PASSWORD` in
`server/.env` (default `nexus-demo-2026` in the example file). The seed
script refuses to run in production, so these credentials are development-only.

Seeded users (from `server/seeds/demo.ts`):

| Email | Name | Role (in Nexus Studio) |
|-------|------|------------------------|
| maya@nexus.studio | Maya Chen | owner |
| elias@nexus.studio | Elias Moreau | admin |
| amara@nexus.studio | Amara Okafor | admin |
| priya@nexus.studio | Priya Raman | member |
| tomas@nexus.studio | Tomás Ferreira | member |
| noor@nexus.studio | Noor Haddad | member |
| kenji@nexus.studio | Kenji Watanabe | member |
| lena@nexus.studio | Lena Fischer | member |

Three workspaces are seeded:

| Workspace | Slug | Plan | Members |
|-----------|------|------|---------|
| Nexus Studio | nexus-studio | Studio | maya, elias, amara, priya, tomas, noor, kenji, lena |
| Halcyon Labs | halcyon-labs | Team | maya, elias, amara, priya, kenji |
| Personal | personal | Personal | maya |

The smoke test and socket flows use `maya@nexus.studio` as the primary actor.

## 5. Verify the Live API Connection

### 5a — Run the smoke test

With the backend running on port 4000 and demo data seeded:

```bash
cd server
npm run smoke http://localhost:4000
```

This exercises: health/ready endpoints, login, session cookie, workspace
membership, project create/update, task create/move/comment, activity feed,
project cascade-delete, and logout. Every assertion prints `✓` on success.

### 5b — Verify frontend live mode

1. Set `NEXT_PUBLIC_NEXUS_API_URL=http://localhost:4000` in `.env.local`.
2. Start the frontend: `npm run dev` (port 3000).
3. Open http://localhost:3000/messages.
4. Sign in as `maya@nexus.studio` with the demo password.
5. Create a conversation, send a message, and verify it appears.
6. Open a second browser tab/window signed in as a different user and verify
   presence/typing indicators sync in real time over Socket.IO.

## 6. Quality Gates

Frontend (root):

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run (30 logic tests)
npm run build       # next build (production)
```

Backend (`server/`):

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run (114 tests, skips DB suites without TEST_DATABASE_URL)
npm run build       # tsc -p tsconfig.build.json
```

## 7. Troubleshooting

### Database connection errors

**Symptom:** `/readyz` returns an error or the backend crashes on start.

Checklist:

1. Is the Docker container running?
   ```bash
   docker ps --filter "name=nexus-postgres"
   ```
   Expected: `nexus-postgres` with status `Up` and port mapping `54329->5432`.

2. Is `DATABASE_URL` in `server/.env` pointing at the right port?
   ```text
   DATABASE_URL=postgres://postgres:postgres@localhost:54329/nexus_dev
   ```

3. Can you reach Postgres directly?
   ```bash
   docker exec -it nexus-postgres psql -U postgres -d nexus_dev -c '\dt'
   ```
   If this fails, the container or credentials are wrong.

4. Did you run migrations?
   ```bash
   cd server
   npm run db:status
   ```

5. Does the `nexus_dev` database exist?
   ```bash
   docker exec -it nexus-postgres psql -U postgres -l
   ```
   If not, create it:
   ```bash
   docker exec -it nexus-postgres createdb -U postgres nexus_dev
   ```

### CORS errors

**Symptom:** Frontend requests to `http://localhost:4000` are blocked by the
browser CORS policy.

Checklist:

1. `CORS_ORIGINS` in `server/.env` must include the frontend origin:
   ```text
   CORS_ORIGINS=http://localhost:3000
   ```

2. The frontend must send requests to the backend origin that matches
   `CORS_ORIGINS` exactly (including protocol and port, no trailing slash).

3. If you run the frontend on a different port, update `CORS_ORIGINS`
   accordingly and restart the backend.

### Cookie / session issues

**Symptom:** Login succeeds but subsequent requests return 401, or the session
cookie is not sent.

Checklist:

1. The frontend and backend must share the same registrable domain for
   `SameSite=Lax` cookies to work. On localhost, both should be
   `http://localhost:*` (different ports are fine).

2. `SESSION_COOKIE_SAMESITE=lax` (default) works for same-site requests.
   If you need cross-site, set `SESSION_COOKIE_SAMESITE=none` and ensure the
   backend is served over HTTPS with `Secure` cookies.

3. The frontend `api()` client sends `credentials: "include"` and the
   `X-Requested-With: nexus` header, which satisfies the CSRF middleware when
   no `Origin` header is present.

4. Session cookies are httpOnly and cannot be read by JavaScript — they are
   sent automatically by the browser on same-site requests.

### Socket.IO connection issues

**Symptom:** Messages page shows no real-time updates; presence/typing do not
sync.

Checklist:

1. `NEXT_PUBLIC_NEXUS_API_URL` must be set in `.env.local` and point at the
   backend (e.g. `http://localhost:4000`).

2. The backend must be running and reachable from the browser.

3. Socket.IO uses WebSocket first with polling fallback. If WebSocket is
   blocked by a proxy or firewall, polling should still work (slower).

4. Socket auth uses the session cookie (`credentials: true` on the client,
   `cors: { credentials: true }` on the server). Cookie auth requires the
   same-site conditions listed above.

5. Check the browser DevTools Network tab for Socket.IO polling/WebSocket
   requests and any 401/403 responses.

### Port conflicts

**Symptom:** `EADDRINUSE` or the frontend/backend fails to bind.

Checklist:

1. Frontend (port 3000):
   ```bash
   # Linux/macOS
   lsof -i :3000
   # Windows
   netstat -ano | findstr :3000
   ```

2. Backend (port 4000):
   ```bash
   # Linux/macOS
   lsof -i :4000
   # Windows
   netstat -ano | findstr :4000
   ```

3. Change the port by setting `PORT` in `server/.env` (backend) or by passing
   a port to `next dev` / `next start` (frontend), and update `CORS_ORIGINS`
   / `APP_BASE_URL` / `NEXT_PUBLIC_NEXUS_API_URL` accordingly.

4. PostgreSQL (port 54329): if another service uses 54329, change the Docker
   host port mapping and update `DATABASE_URL` / `TEST_DATABASE_URL`.

## Directory Structure

```
NEXUS/
├── .env.example              # frontend env example (copy to .env.local)
├── package.json              # frontend scripts
├── src/                      # frontend source (Next.js App Router)
├── server/
│   ├── .env.example          # backend env example (copy to .env)
│   ├── package.json          # backend scripts
│   ├── src/
│   │   ├── index.ts          # backend entry (HTTP + Socket.IO)
│   │   ├── db/migrate.ts     # migration runner (up/reset/status)
│   │   ├── modules/          # domain modules (tasks, events, conversations…)
│   │   └── …
│   ├── migrations/           # 0001–0010 SQL migrations
│   ├── seeds/
│   │   └── demo.ts           # demo data seed (3 workspaces, 8 members…)
│   ├── scripts/
│   │   └── smoke.ts          # end-to-end smoke test
│   └── tests/                # API test suites
```

## Safety Notes

- Never commit `.env` or `.env.local` — both are gitignored.
- `DEMO_PASSWORD` is for development only. The seed script refuses to run when
  `NODE_ENV=production`.
- `npm run db:reset` drops and recreates the `public` schema. Never run it
  against a database holding real data.
- Tests use `TEST_DATABASE_URL` (default `nexus_test`) and skip automatically
  when it is unset.
