# NEXUS API — server

Express + TypeScript backend for NEXUS. Lives in-repo as an **independent
package** with its own toolchain; the Next.js frontend at the repository root is
never built, linted or type-checked by this package (and vice versa — the root
`tsconfig.json`/ESLint config exclude `server/`).

**Current status — Phase 3 (core project management):** Phase 1 foundation +
database, Phase 2 authentication & authorization, plus projects, tasks (with
kanban position renumbering), labels, subtasks, comments, attachment metadata,
calendar events, activity logging and notifications. Real-time collaboration,
dashboard/report aggregation and file bytes arrive in later phases.

## Requirements

- Node.js ≥ 20.19 (developed on 24)
- PostgreSQL 14+ — local Docker or [Neon](https://neon.tech)

## Quick start (local)

```powershell
# 1. Start a disposable Postgres (any Postgres 14+ works; adjust the URL)
docker run -d --name nexus-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nexus_dev -p 54329:5432 postgres:17-alpine

# 2. Install and configure
cd server
npm install
copy .env.example .env      # defaults match the Docker command above

# 3. Create the schema and seed demo data
npm run db:migrate
npm run db:seed

# 4. Run the API (http://localhost:4000)
npm run dev

# 5. (optional, with the server running) end-to-end auth smoke test
npm run smoke -- http://localhost:4000
```

Probes: `GET /healthz` (liveness), `GET /readyz` (database round-trip),
`GET /api/v1` (service banner).

Demo login: any seeded email (e.g. `maya@nexus.studio`) with the
`DEMO_PASSWORD` value (default `nexus-demo-2026`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Watch-mode API server (`tsx`) |
| `npm run build` / `start` | Compile `src/` to `dist/` and run it |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint (typescript-eslint) |
| `npm test` | Vitest (unit suites always run; DB suites skip without `TEST_DATABASE_URL`) |
| `npm run db:migrate` | Apply pending SQL migrations (advisory-locked, transactional) |
| `npm run db:status` | Show applied/pending migrations |
| `npm run db:reset` | **Dev only** — drop the public schema and re-apply all migrations |
| `npm run db:seed` | Seed the demo dataset (`-- --fresh` to replace existing data) |
| `npm run smoke -- <url>` | End-to-end auth smoke test against a running server |

## Tests

```powershell
# Unit suites run anywhere; migration/seed suites need a disposable database:
$env:TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:54329/nexus_test"
docker exec nexus-postgres psql -U postgres -c "CREATE DATABASE nexus_test"
npm test
```

The migration suite resets its database (`DROP SCHEMA public CASCADE`) — only
ever point `TEST_DATABASE_URL` at a scratch database.

## Database

Plain, forward-only SQL migrations in `migrations/`, named
`NNNN_domain.sql` and applied in order by `src/db/migrate.ts` (each file runs
in its own transaction; applied names are recorded in `schema_migrations`).

| Migration | Domain | First consumed by |
| --- | --- | --- |
| `0001_extensions` | platform | Phase 1 |
| `0002_users_and_sessions` | identity | Phase 2 (auth) |
| `0003_workspaces_and_membership` | tenancy | Phase 2 (workspace authorization) |
| `0004_projects_and_membership` | portfolio | Phase 3 |
| `0005_tasks_and_children` | work management | Phase 3 |
| `0006_calendar_events` | calendar | Phase 3 / 5 |
| `0007_conversations_and_messages` | messaging | Phase 4 |
| `0008_notifications` | notifications | Phase 4 / 5 |
| `0009_activities` | activity/audit | Phase 3 / 4 |
| `0010_uploads` | files | Phase 6 |

The complete schema is designed upfront (per the approved plan): every
tenant-owned table carries `workspace_id`, deletes cascade down the ownership
tree, and project deletion detaches events/conversations/activities
(`ON DELETE SET NULL`), mirroring the frontend store's `deleteProject`.

### API/DB naming note

The tasks table column is `sort_order` (ORDER is a reserved SQL word); the API
serializes it as `order` to match the frontend `Task.order` field. All other
columns map 1:1 to camelCase API fields.

## Demo seed data

`seeds/demo.ts` mirrors the frontend's localStorage dataset: 3 workspaces,
8 members, 9 projects, 46 tasks, subtasks/comments/attachments, 10 events,
5 conversations, 12 notifications and the 18-entry activity feed, with
timestamps relative to seed time.

- **Demo credentials are predictable** (`DEMO_PASSWORD`, default
  `nexus-demo-2026`) and exist only for development. The seed **refuses to run
  when `NODE_ENV=production`** — never set `DEMO_PASSWORD` on a real database.
- Demo emails are fictional (`maya@nexus.studio`, …).

## Conventions

- Response envelope: success `{ "data": … }`, error
  `{ "error": { code, message, details? } }` with stable machine codes.
- All input validated with Zod; UUID identifiers; ISO-8601 UTC timestamps.
- Hand-written parameterized SQL via `pg` (no ORM); multi-statement mutations
  go through `withTransaction`. node-postgres unnamed prepared statements are
  PgBouncer-safe (required for Neon's pooled endpoint).
- Secrets never logged (pino redacts cookies/authorization headers).

## Authentication & authorization

- **Passwords:** Argon2id (m=19456 KiB, t=2, p=1) via `@node-rs/argon2`.
- **Sessions:** 256-bit random cookie token; only its SHA-256 hash is stored
  (`sessions.token_hash`). Cookie is `HttpOnly`, `Secure` in production,
  `SameSite=Lax` by default, 30-day absolute expiry, sliding `last_used_at`
  renewal, revoked on logout / password change / reset.
- **Email verification:** soft-gate — accounts work immediately; a verification
  link is issued at registration (`email_verified_at` set on confirm).
- **Password reset:** single-use, 1-hour token; resets revoke every session.
  Forgot-password always returns 200 (no account enumeration).
- **Login hardening:** generic failure message, per-account exponential lockout
  after repeated failures, per-IP rate limits on auth routes.
- **CSRF:** SameSite cookies + Origin/Referer validation (with an
  `X-Requested-With: nexus` fallback) on cookie-bearing state-changing requests.
- **RBAC:** roles `owner > admin > member > viewer`, enforced by
  `requireMembership` / `requireRole` in the workspace service. Every
  workspace-scoped route re-verifies membership before touching an entity; a
  non-member sees `404` (never leaks existence). The last owner of a workspace
  cannot be demoted or removed.

### Endpoints (Phase 2)

```
POST   /api/v1/auth/register              POST   /api/v1/auth/login
POST   /api/v1/auth/logout                GET    /api/v1/auth/me
GET    /api/v1/auth/session               POST   /api/v1/auth/verify-email
POST   /api/v1/auth/resend-verification   POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password        PATCH  /api/v1/auth/password

GET    /api/v1/me                         PATCH  /api/v1/me/profile
PATCH  /api/v1/me/preferences             PATCH  /api/v1/me/active-workspace

GET    /api/v1/workspaces                 POST   /api/v1/workspaces
GET    /api/v1/workspaces/:id             PATCH  /api/v1/workspaces/:id
DELETE /api/v1/workspaces/:id
GET    /api/v1/workspaces/:id/members     PATCH  /api/v1/workspaces/:id/members/:userId
DELETE /api/v1/workspaces/:id/members/:userId
GET    /api/v1/workspaces/:id/invitations POST   /api/v1/workspaces/:id/invitations
DELETE /api/v1/workspaces/:id/invitations/:invitationId
GET    /api/v1/invitations/:token         POST   /api/v1/invitations/accept
```

### Endpoints (Phase 3)

```
GET    /api/v1/workspaces/:id/projects        POST   /api/v1/workspaces/:id/projects
GET    /api/v1/workspaces/:id/labels
GET    /api/v1/projects/:projectId            PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId
GET    /api/v1/projects/:projectId/tasks      GET    /api/v1/projects/:projectId/activity

GET    /api/v1/workspaces/:id/tasks           POST   /api/v1/workspaces/:id/tasks
GET    /api/v1/tasks/:taskId                  PATCH  /api/v1/tasks/:taskId
DELETE /api/v1/tasks/:taskId                  PATCH  /api/v1/tasks/:taskId/position
POST   /api/v1/tasks/:taskId/subtasks         PATCH  /api/v1/tasks/:taskId/subtasks/:subtaskId
DELETE /api/v1/tasks/:taskId/subtasks/:subtaskId
GET    /api/v1/tasks/:taskId/comments         POST   /api/v1/tasks/:taskId/comments
POST   /api/v1/tasks/:taskId/attachments      DELETE /api/v1/tasks/:taskId/attachments/:attachmentId

GET    /api/v1/workspaces/:id/events          POST   /api/v1/workspaces/:id/events
PATCH  /api/v1/events/:eventId                DELETE /api/v1/events/:eventId

GET    /api/v1/workspaces/:id/activity
GET    /api/v1/workspaces/:id/notifications   POST   /api/v1/workspaces/:id/notifications/read-all
POST   /api/v1/notifications/:notificationId/read
```

### Domain semantics (parity with the frontend store)

- **Project keys** are derived from the name (first three letters, e.g. `ATL`)
  and made unique per workspace with a numeric suffix (`ATL2`).
- **Task ordering** mirrors `moveTask`: `PATCH /tasks/:id/position` renumbers the
  whole target column `1..n` in one transaction; new tasks append
  (`max(order)+1`). The API field is `order`; the column is `sort_order`.
- **Completion** stamps `completedAt` on entering `done` and clears it on leave.
- **Activity** rows are written inside the same transaction as every mutation.
- **Assignment** creates a per-recipient notification (unassigning/reassigning
  re-notifies the new assignee).
- **Cascade:** deleting a project deletes its tasks and detaches its
  events/conversations/activities (`project_id → NULL`).
- **Validation** mirrors the frontend dialogs (title ≥ 2, description limits,
  labels must exist in the workspace catalog, members must belong to the
  workspace).

## Email transport

Development and test use a **console transport** that logs the full message
(including verification / reset / invite links) — no paid provider is needed to
develop or test account flows. Production should wire a transactional provider
(Resend, per Decision D6); `src/lib/mail.ts` exposes a provider-agnostic
interface, and the production placeholder fails loudly rather than dropping
mail silently.

## Deployment notes (D2)

- **Topology:** Vercel (frontend) + Render (this API + Socket.IO in Phase 4),
  ideally under **one registrable domain** (`www.nexus.app` + `api.nexus.app`)
  so session cookies are first-party and `SameSite=Lax` works.
- **Render:** long-running process (not serverless functions) is required for
  Socket.IO. Set `trust proxy` (already enabled) so `req.ip` is correct.
- **Neon:** use the pooled connection string for the app and the direct string
  for migrations/seeds (`DATABASE_URL_DIRECT`). TLS is enabled automatically for
  non-local hosts.
- **Cross-site fallback:** if the frontend and API cannot share a registrable
  domain, set `SESSION_COOKIE_SAMESITE=none` (requires `Secure`); note Safari
  blocks third-party cookies, so same-domain remains the recommendation.
- **Migrations on deploy:** run `npm run db:migrate` as a Render release/pre-deploy
  step against the direct (unpooled) endpoint.
