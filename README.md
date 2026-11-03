# NEXUS

A premium, project-management workspace UI built with Next.js — projects, tasks, a drag-and-drop board, calendar, team, messages, reports and settings — rendered with an editorial "Quiet Instrument" design language: warm neutrals, one cobalt signal, and status-only colour.

> **Local demo.** NEXUS is a frontend-only application. Every record is seeded, every interaction is real, and all state persists to `localStorage` in your browser. Nothing leaves your device, and there is no backend, authentication or email delivery.

## Modules

| Area | What it does |
| --- | --- |
| Dashboard | Greeting, focus list (overdue → priority → due date), completion chart, project health, agenda and activity feed — all derived live from the store |
| Projects | Portfolio grid/list with filters, sorting, stat tiles; detail screen with status/priority/due editing, scoped tasks, team, activity and safe delete |
| My Tasks | Kanban board with `dnd-kit` drag-and-drop (pointer + keyboard), list and inline-editing table views, rich filters, task detail sheet with subtasks/comments/attachments |
| Calendar | Month, week and day views, agenda rail, next-up list, create/delete events, week start honoured from preferences |
| Team | Directory with search, role filter, presence and per-member open-task load |
| Messages | Two-pane threads (direct and project-linked), day separation, unread receipts, enter-to-send composer |
| Reports | Recharts: throughput (completed vs created), tasks by status, open work by priority, load balance by owner, project delivery — all computed from the same store |
| Settings | Profile, workspace identity, appearance (Paper / Graphite / system), reduced-motion, start-of-week, notification preferences, JSON backup export, full demo reset |

## Stack

Next.js 16.4 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui (Radix) · Zustand (persist middleware) · Framer Motion · Recharts · dnd-kit · React Hook Form + Zod · Vitest · Playwright (validation)

Design: Geist Sans, Geist Mono and Instrument Serif via `next/font`; Paper (light) and Graphite (dark) themes driven by `next-themes` and CSS custom properties.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm run start -- -p 3001
```

Quality gates:

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest run (logic tests)
npm run test:coverage
```

## Architecture

- **`src/features/*`** — smart module screens; data selection, interaction and derived state live here.
- **`src/components/*`** — presentational shell (`layout`, `shared`, `ui`, `forms`). No feature-to-feature imports.
- **`src/lib/selectors.ts`** — pure, unit-tested selectors. Metrics are derived, never hardcoded.
- **`src/store/workspace-store.ts`** — persisted domain store (`nexus:data:v1`, versioned, merge-validated). **`ui-store.ts`** holds chrome only (`nexus:ui:v2`).
- **`src/data/seed/*`** — seed dataset with timestamps relative to load time (9 projects, 46 tasks, 19 events, 6 conversations, 10 notifications, 18 activity entries, 3 workspaces, 8 members).
- **`src/types/domain.ts`** — authoritative domain model (`PersistedState` is the persisted envelope).

## Demo data & reset

State lives in two versioned localStorage keys (`nexus:data:v1`, `nexus:ui:v2`). **Settings → Data & reset** either downloads a JSON backup or restores the pristine seed. Creating/editing/dragging real records is the intended way to explore.

## Validation

- `npm run build` — production build succeeds; all static routes prerender, `/projects/[projectId]` is dynamic.
- `npm run typecheck` — clean. `npm run lint` — 0 errors (4 informational React Compiler notes from `react-hook-form`'s `watch()`, expected).
- `npm test` — 30/30 logic tests pass (selectors + store mutations, incl. the persistence envelope).
- Playwright (production server) — **59/59 checks pass**: shell, themes, command palette, workspace switching, every module flow (create event, send message, drag between board columns, reset), desktop + mobile layouts, zero console errors.
- `npm audit --omit=dev` — **0 vulnerabilities**.

## Honest limitations

- No backend, no auth, no multi-user sync, no email. Presence is simulated.
- Notification preference toggles persist locally but do not send anything.
- "Reduce motion" and "week starts on" are fully functional; the local environment has no server authority to enforce anything beyond this browser.
- Attachment UI accepts metadata only (name/size) — no file upload path exists.
