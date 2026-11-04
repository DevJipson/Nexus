/**
 * Development demo seed.
 *
 * Mirrors the structure and story of the frontend's localStorage dataset
 * (`src/data/seed/*`): 3 workspaces, 8 members, 9 projects, 46 tasks,
 * subtasks/comments/attachments, events, conversations, notifications and the
 * 18-entry activity feed. Identifiers become real UUIDs; timestamps are
 * computed relative to seed time so overdue/upcoming work stays live, exactly
 * like the frontend's `seedAt` helper.
 *
 * SAFETY: demo accounts use one predictable password (DEMO_PASSWORD). The
 * script refuses to run when NODE_ENV=production so seed credentials can never
 * reach a production database.
 *
 * Usage:
 *   npm run db:seed            # refuses if data already exists
 *   npm run db:seed -- --fresh # truncates all domain tables first
 */
import "dotenv/config";
import type { PoolClient } from "pg";
import { getEnv, type Env } from "../src/config/env";
import { runMigrations } from "../src/db/migrate";
import { createDatabasePool } from "../src/db/pool";
import { createLogger, type Logger } from "../src/lib/logger";
import { hashPassword } from "../src/lib/passwords";

const DAY_MS = 86_400_000;

/** Timestamp `dayOffset` days from now, pinned to a wall-clock time (mirrors seedAt). */
function at(dayOffset: number, hour = 9, minute = 0): Date {
  const date = new Date(Date.now() + dayOffset * DAY_MS);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/* -------------------------------------------------------------------------- */
/* Seed definitions (mirroring src/data/seed)                                 */
/* -------------------------------------------------------------------------- */

type Role = "owner" | "admin" | "member" | "viewer";
type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
type Priority = "low" | "medium" | "high" | "urgent";
type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";

interface DemoUser {
  key: string;
  name: string;
  email: string;
  title: string;
  bio: string;
  location: string;
  timezone: string;
  avatarHue: number;
}

const DEMO_USERS: DemoUser[] = [
  { key: "maya", name: "Maya Chen", email: "maya@nexus.studio", title: "Founder & Product Lead", bio: "Designs the systems behind calm, fast product teams. Currently focused on the Atlas design language.", location: "Brooklyn, NY", timezone: "America/New_York", avatarHue: 264 },
  { key: "elias", name: "Elias Moreau", email: "elias@nexus.studio", title: "Engineering Lead", bio: "Ships the platform. Opinionated about boundaries, observability and boring infrastructure.", location: "Paris, FR", timezone: "Europe/Paris", avatarHue: 20 },
  { key: "priya", name: "Priya Raman", email: "priya@nexus.studio", title: "Senior Frontend Engineer", bio: "Interface systems, motion and accessibility. Keeps the component library honest.", location: "Bengaluru, IN", timezone: "Asia/Kolkata", avatarHue: 150 },
  { key: "tomas", name: "Tomás Ferreira", email: "tomas@nexus.studio", title: "Product Designer", bio: "Turns ambiguous briefs into precise interfaces. Prototypes in the browser.", location: "São Paulo, BR", timezone: "America/Sao_Paulo", avatarHue: 318 },
  { key: "noor", name: "Noor Haddad", email: "noor@nexus.studio", title: "Brand & Content", bio: "Writes the words and shapes the identity. Believes clarity is a design material.", location: "London, UK", timezone: "Europe/London", avatarHue: 70 },
  { key: "kenji", name: "Kenji Watanabe", email: "kenji@nexus.studio", title: "Backend Engineer", bio: "Data models, sync and performance. Happiest when a query plan is clean.", location: "Tokyo, JP", timezone: "Asia/Tokyo", avatarHue: 190 },
  { key: "amara", name: "Amara Okafor", email: "amara@nexus.studio", title: "Project Manager", bio: "Keeps delivery predictable without making it rigid. Runs the weekly operating rhythm.", location: "Lagos, NG", timezone: "Africa/Lagos", avatarHue: 340 },
  { key: "lena", name: "Lena Fischer", email: "lena@nexus.studio", title: "QA Engineer", bio: "Adversarial by default. Finds the edge case before your users do.", location: "Berlin, DE", timezone: "Europe/Berlin", avatarHue: 250 },
];

interface DemoWorkspace {
  key: string;
  name: string;
  slug: string;
  plan: "Studio" | "Team" | "Personal";
  description: string;
  accentHue: number;
  members: Array<{ user: string; role: Role }>;
}

const STUDIO_MEMBERS: Array<{ user: string; role: Role }> = [
  { user: "maya", role: "owner" },
  { user: "elias", role: "admin" },
  { user: "amara", role: "admin" },
  { user: "priya", role: "member" },
  { user: "tomas", role: "member" },
  { user: "noor", role: "member" },
  { user: "kenji", role: "member" },
  { user: "lena", role: "member" },
];

const DEMO_WORKSPACES: DemoWorkspace[] = [
  { key: "ws-studio", name: "Nexus Studio", slug: "nexus-studio", plan: "Studio", description: "Client product design and engineering", accentHue: 264, members: STUDIO_MEMBERS },
  {
    key: "ws-halcyon", name: "Halcyon Labs", slug: "halcyon-labs", plan: "Team", description: "Internal R&D and product experiments", accentHue: 168,
    members: [
      { user: "maya", role: "owner" },
      { user: "elias", role: "admin" },
      { user: "amara", role: "admin" },
      { user: "priya", role: "member" },
      { user: "kenji", role: "member" },
    ],
  },
  {
    key: "ws-personal", name: "Personal", slug: "personal", plan: "Personal", description: "Solo planning and side projects", accentHue: 38,
    members: [{ user: "maya", role: "owner" }],
  },
];

/** The ten fixed frontend labels with their domain-meta hues, seeded per workspace. */
const DEMO_LABELS: Array<{ name: string; hue: number }> = [
  { name: "design", hue: 280 },
  { name: "frontend", hue: 264 },
  { name: "backend", hue: 210 },
  { name: "research", hue: 168 },
  { name: "bug", hue: 25 },
  { name: "infra", hue: 235 },
  { name: "content", hue: 70 },
  { name: "qa", hue: 340 },
  { name: "growth", hue: 120 },
  { name: "ops", hue: 300 },
];

interface DemoProject {
  key: string;
  workspace: string;
  name: string;
  shortKey: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  colorHue: number;
  startOffset: number;
  dueOffset: number;
  createdDaysAgo: number;
  updated: { daysAgo: number; hour: number };
  members: string[];
}

const DEMO_PROJECTS: DemoProject[] = [
  { key: "p-atlas", workspace: "ws-studio", name: "Atlas design language", shortKey: "ATL", description: "A single visual and interaction language for every NEXUS surface — tokens, primitives and the documentation that keeps them honest.", status: "active", priority: "high", colorHue: 264, startOffset: -56, dueOffset: 24, createdDaysAgo: 58, updated: { daysAgo: 1, hour: 16 }, members: ["maya", "tomas", "priya", "noor", "lena"] },
  { key: "p-meridian", workspace: "ws-studio", name: "Meridian mobile app", shortKey: "MER", description: "The companion app for NEXUS: offline-first sync, a focused inbox and a launch that does not wake the team at midnight.", status: "active", priority: "urgent", colorHue: 210, startOffset: -84, dueOffset: 12, createdDaysAgo: 86, updated: { daysAgo: 0, hour: 11 }, members: ["maya", "elias", "priya", "kenji", "lena", "amara"] },
  { key: "p-northwind", workspace: "ws-studio", name: "Northwind onboarding", shortKey: "NWD", description: "Rethink the first ten minutes of NEXUS so a new team reaches its first meaningful action without a tour or a manual.", status: "planning", priority: "medium", colorHue: 150, startOffset: -10, dueOffset: 60, createdDaysAgo: 12, updated: { daysAgo: 2, hour: 14 }, members: ["maya", "noor", "amara", "tomas"] },
  { key: "p-helios", workspace: "ws-studio", name: "Helios site redesign", shortKey: "HEL", description: "The marketing site rebuilt on the Atlas system — faster pages, a clearer story and one honest illustration set.", status: "completed", priority: "low", colorHue: 38, startOffset: -140, dueOffset: -18, createdDaysAgo: 142, updated: { daysAgo: 18, hour: 17 }, members: ["maya", "tomas", "priya", "lena"] },
  { key: "p-quiet", workspace: "ws-studio", name: "Quiet hours initiative", shortKey: "QHR", description: "An organisation-level answer to notification fatigue: default quiet hours, clearer batching and a policy the team actually follows.", status: "on_hold", priority: "medium", colorHue: 318, startOffset: -40, dueOffset: 45, createdDaysAgo: 42, updated: { daysAgo: 8, hour: 10 }, members: ["maya", "noor", "amara", "tomas"] },
  { key: "p-signal", workspace: "ws-halcyon", name: "Signal research programme", shortKey: "SIG", description: "A six-week study into how small teams notice, discuss and act on weak signals in their own delivery data.", status: "active", priority: "high", colorHue: 168, startOffset: -30, dueOffset: 50, createdDaysAgo: 32, updated: { daysAgo: 1, hour: 9 }, members: ["maya", "priya", "kenji"] },
  { key: "p-ember", workspace: "ws-halcyon", name: "Ember prototype", shortKey: "EMB", description: "A deliberately small experiment: can a command surface replace half of the navigation without hiding the work?", status: "planning", priority: "medium", colorHue: 20, startOffset: -6, dueOffset: 70, createdDaysAgo: 8, updated: { daysAgo: 0, hour: 9 }, members: ["maya", "elias", "kenji"] },
  { key: "p-portfolio", workspace: "ws-personal", name: "Portfolio refresh", shortKey: "PRT", description: "Rebuild the personal site around three case studies and a short, honest statement of how I work.", status: "active", priority: "medium", colorHue: 264, startOffset: -20, dueOffset: 35, createdDaysAgo: 22, updated: { daysAgo: 4, hour: 18 }, members: ["maya"] },
  { key: "p-reading", workspace: "ws-personal", name: "Reading & notes", shortKey: "RDN", description: "A slow queue of books and papers, with notes worth keeping rather than a completion count.", status: "planning", priority: "low", colorHue: 70, startOffset: -60, dueOffset: 90, createdDaysAgo: 62, updated: { daysAgo: 10, hour: 21 }, members: ["maya"] },
];

interface DemoTask {
  project: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string | null;
  /** Due date offset in days from seed time (negative = overdue), 17:00 convention. */
  dueOffset: number | null;
  labels: string[];
  createdDaysAgo: number;
  completedDaysAgo?: number;
  subtasks?: Array<{ title: string; done: boolean }>;
  comments?: Array<{ author: string; body: string; daysAgo: number; hour: number; minute?: number }>;
  attachments?: Array<{ name: string; sizeBytes: number; mimeType: string }>;
}

const DEMO_TASKS: DemoTask[] = [
  // ── Atlas design language ────────────────────────────────────────────────
  { project: "p-atlas", title: "Define the type scale", description: "One scale across every surface: display, heading, body and mono.", status: "done", priority: "high", assignee: "tomas", dueOffset: null, labels: ["design"], createdDaysAgo: 30, completedDaysAgo: 12 },
  { project: "p-atlas", title: "Build the colour token layer", description: "Semantic tokens for Paper and Graphite, with one cobalt signal.", status: "done", priority: "high", assignee: "priya", dueOffset: null, labels: ["design", "frontend"], createdDaysAgo: 28, completedDaysAgo: 10 },
  { project: "p-atlas", title: "Write the component inventory", description: "Every primitive, its states and where it is allowed to bend.", status: "done", priority: "medium", assignee: "noor", dueOffset: null, labels: ["content", "design"], createdDaysAgo: 25, completedDaysAgo: 8 },
  { project: "p-atlas", title: "Design the data-density states", description: "Comfortable and compact must remove padding, never type size.", status: "in_progress", priority: "high", assignee: "tomas", dueOffset: 3, labels: ["design"], createdDaysAgo: 18 },
  { project: "p-atlas", title: "Implement the shell primitives", description: "Sidebar, header and sheet shells on the new tokens.", status: "in_progress", priority: "urgent", assignee: "priya", dueOffset: 2, labels: ["frontend"], createdDaysAgo: 16 },
  { project: "p-atlas", title: "Audit contrast in Graphite", description: "Every text pair in the dark theme, measured and signed off.", status: "in_review", priority: "medium", assignee: "lena", dueOffset: -2, labels: ["qa", "design"], createdDaysAgo: 12 },
  { project: "p-atlas", title: "Document motion guidelines", description: "Durations, easings and the reduced-motion contract.", status: "todo", priority: "low", assignee: "noor", dueOffset: 9, labels: ["content"], createdDaysAgo: 9 },
  { project: "p-atlas", title: "Cover keyboard navigation", description: "Focus order, roving focus and visible focus rings for every primitive.", status: "backlog", priority: "medium", assignee: "priya", dueOffset: 21, labels: ["frontend", "qa"], createdDaysAgo: 7 },

  // ── Meridian mobile app ──────────────────────────────────────────────────
  { project: "p-meridian", title: "Ship onboarding flow v2", description: "Three screens, one decision each, straight into a real workspace.", status: "in_progress", priority: "urgent", assignee: "priya", dueOffset: 0, labels: ["frontend", "design"], createdDaysAgo: 20 },
  { project: "p-meridian", title: "Instrument the sync engine", description: "Emit queue depth, conflict counts and latency to the dashboard.", status: "in_progress", priority: "high", assignee: "elias", dueOffset: 5, labels: ["backend", "infra"], createdDaysAgo: 19 },
  { project: "p-meridian", title: "Resolve offline draft conflicts", description: "Last-writer-wins per field, with a reviewable diff.", status: "in_review", priority: "urgent", assignee: "kenji", dueOffset: 1, labels: ["backend"], createdDaysAgo: 18 },
  { project: "p-meridian", title: "Redesign the empty inbox", description: "The inbox should teach the sync model in one sentence.", status: "in_progress", priority: "medium", assignee: "tomas", dueOffset: 6, labels: ["design"], createdDaysAgo: 15, comments: [{ author: "noor", body: "Empty state copy is drafted — dropping it into the brief.", daysAgo: 3, hour: 14, minute: 50 }] },
  { project: "p-meridian", title: "Add biometric unlock", description: "Face ID and fingerprint via the platform store, no PIN fallback.", status: "todo", priority: "high", assignee: "kenji", dueOffset: 10, labels: ["backend"], createdDaysAgo: 12 },
  { project: "p-meridian", title: "QA pass on tablet layouts", description: "Both densities, both orientations, real content.", status: "todo", priority: "medium", assignee: "lena", dueOffset: 8, labels: ["qa"], createdDaysAgo: 10 },
  { project: "p-meridian", title: "Localise the first-run copy", description: "Five launch languages; strings extracted and reviewed.", status: "backlog", priority: "low", assignee: "noor", dueOffset: 30, labels: ["content"], createdDaysAgo: 9 },
  { project: "p-meridian", title: "Crash on Android 13 launch", description: "Repro on a Pixel 7 — the crash is in the sync warm-up path.", status: "in_progress", priority: "urgent", assignee: "elias", dueOffset: -1, labels: ["bug", "backend"], createdDaysAgo: 6, comments: [{ author: "lena", body: "Repro on a Pixel 7 — the crash is in the sync warm-up path.", daysAgo: 1, hour: 17, minute: 30 }] },
  { project: "p-meridian", title: "Define the launch checklist", description: "Store assets, crash rate, rollback plan, support coverage.", status: "done", priority: "medium", assignee: "amara", dueOffset: null, labels: ["ops"], createdDaysAgo: 14, completedDaysAgo: 2 },
  { project: "p-meridian", title: "Test push notification permissions", description: "Provisional and denied states, plus the settings deep link.", status: "done", priority: "medium", assignee: "lena", dueOffset: null, labels: ["qa"], createdDaysAgo: 13, completedDaysAgo: 5 },

  // ── Northwind onboarding ─────────────────────────────────────────────────
  { project: "p-northwind", title: "Map the current onboarding funnel", description: "Where new teams stall today, from invite to first meaningful action.", status: "in_progress", priority: "high", assignee: "maya", dueOffset: 4, labels: ["research"], createdDaysAgo: 8 },
  { project: "p-northwind", title: "Interview five new customers", description: "Teams that joined in the last month, mixed sizes.", status: "todo", priority: "high", assignee: "amara", dueOffset: 9, labels: ["research"], createdDaysAgo: 7 },
  { project: "p-northwind", title: "Draft the welcome sequence", description: "Four emails maximum; each one earns its send.", status: "todo", priority: "medium", assignee: "noor", dueOffset: 12, labels: ["content"], createdDaysAgo: 6 },
  { project: "p-northwind", title: "Choose activation metrics", description: "One honest metric, not a vanity dashboard.", status: "backlog", priority: "medium", assignee: "maya", dueOffset: 20, labels: ["research", "ops"], createdDaysAgo: 5 },
  { project: "p-northwind", title: "Storyboard the first-run journey", description: "Panel by panel, with the copy in place.", status: "in_review", priority: "medium", assignee: "tomas", dueOffset: 2, labels: ["design"], createdDaysAgo: 4 },

  // ── Helios site redesign ─────────────────────────────────────────────────
  { project: "p-helios", title: "Migrate marketing pages", description: "Every page onto the Atlas primitives.", status: "done", priority: "medium", assignee: "priya", dueOffset: null, labels: ["frontend"], createdDaysAgo: 60, completedDaysAgo: 20 },
  { project: "p-helios", title: "Refresh the illustration set", description: "One honest set, drawn for the new palette.", status: "done", priority: "low", assignee: "tomas", dueOffset: null, labels: ["design"], createdDaysAgo: 55, completedDaysAgo: 19 },
  { project: "p-helios", title: "Retire legacy components", description: "Delete what Helios no longer imports.", status: "done", priority: "medium", assignee: "priya", dueOffset: null, labels: ["frontend", "infra"], createdDaysAgo: 50, completedDaysAgo: 19 },
  { project: "p-helios", title: "Final accessibility sign-off", description: "Keyboard, screen reader and contrast, signed off.", status: "done", priority: "high", assignee: "lena", dueOffset: null, labels: ["qa"], createdDaysAgo: 45, completedDaysAgo: 18 },

  // ── Quiet hours initiative ───────────────────────────────────────────────
  { project: "p-quiet", title: "Benchmark notification volume", description: "What a normal week actually sends, measured.", status: "todo", priority: "medium", assignee: "amara", dueOffset: 14, labels: ["research"], createdDaysAgo: 10 },
  { project: "p-quiet", title: "Prototype quiet hours settings", description: "Defaults that respect evenings without hiding urgent work.", status: "in_progress", priority: "medium", assignee: "tomas", dueOffset: 16, labels: ["design"], createdDaysAgo: 9 },
  { project: "p-quiet", title: "Draft the policy proposal", description: "A policy the team will actually follow, in one page.", status: "backlog", priority: "low", assignee: "noor", dueOffset: 30, labels: ["content"], createdDaysAgo: 8 },
  { project: "p-quiet", title: "Align with support team", description: "Escalation path when quiet hours are on.", status: "backlog", priority: "medium", assignee: "amara", dueOffset: 25, labels: ["ops"], createdDaysAgo: 7 },

  // ── Signal research programme ────────────────────────────────────────────
  { project: "p-signal", title: "Recruit interview cohort", description: "Eight teams, mixed size and discipline, none of them already using our tooling.", status: "in_progress", priority: "high", assignee: "priya", dueOffset: 4, labels: ["research"], createdDaysAgo: 20, comments: [{ author: "priya", body: "Five confirmed, three waiting. One team is a good outlier.", daysAgo: 2, hour: 9, minute: 5 }] },
  { project: "p-signal", title: "Synthesise week-one findings", description: "Tag the transcripts, then write the three observations that keep recurring.", status: "in_progress", priority: "medium", assignee: "maya", dueOffset: 7, labels: ["research", "content"], createdDaysAgo: 16 },
  { project: "p-signal", title: "Build the analysis notebook", description: "A reproducible notebook that turns the transcripts into a small set of defensible claims.", status: "in_review", priority: "high", assignee: "kenji", dueOffset: 2, labels: ["backend", "research"], createdDaysAgo: 14, subtasks: [{ title: "Load and normalise transcripts", done: true }, { title: "Theme extraction", done: true }, { title: "Confidence notes", done: false }] },
  { project: "p-signal", title: "Schedule the readout", description: "Book the room, invite the studio, and circulate the pre-read two days early.", status: "todo", priority: "medium", assignee: "maya", dueOffset: 11, labels: ["ops"], createdDaysAgo: 10 },
  { project: "p-signal", title: "Define the hypothesis tree", description: "Three branches: noticing, discussing, acting. Each with a falsifiable claim.", status: "done", priority: "high", assignee: "maya", dueOffset: null, labels: ["research"], createdDaysAgo: 28, completedDaysAgo: 9 },
  { project: "p-signal", title: "Publish the discussion guide", description: "A guide that invites stories instead of confirming our own assumptions.", status: "done", priority: "medium", assignee: "priya", dueOffset: null, labels: ["content", "research"], createdDaysAgo: 26, completedDaysAgo: 14 },

  // ── Ember prototype ──────────────────────────────────────────────────────
  { project: "p-ember", title: "Sketch the interaction model", description: "What if the command palette became the primary navigation? Map the states before building anything.", status: "in_progress", priority: "high", assignee: "maya", dueOffset: 8, labels: ["design", "research"], createdDaysAgo: 5, subtasks: [{ title: "Map entry points", done: true }, { title: "Define escape routes", done: false }, { title: "Decide what stays visible", done: false }] },
  { project: "p-ember", title: "Evaluate the rendering budget", description: "Measure the cost of a permanently mounted palette on a mid-range laptop.", status: "todo", priority: "medium", assignee: "elias", dueOffset: 15, labels: ["infra"], createdDaysAgo: 4 },
  { project: "p-ember", title: "Prototype the command surface", description: "A working prototype, keyboard-first, with real data from this workspace.", status: "todo", priority: "high", assignee: "kenji", dueOffset: 19, labels: ["frontend"], createdDaysAgo: 3 },
  { project: "p-ember", title: "Write the experiment brief", description: "Hypothesis, method, success threshold and the date we decide to stop.", status: "in_review", priority: "medium", assignee: "maya", dueOffset: 1, labels: ["content", "research"], createdDaysAgo: 6, comments: [{ author: "elias", body: "Add a kill criterion. Otherwise this runs forever.", daysAgo: 1, hour: 10 }] },

  // ── Portfolio refresh ────────────────────────────────────────────────────
  { project: "p-portfolio", title: "Select the case studies", description: "Three projects that show range without pretending the rest did not happen.", status: "in_progress", priority: "medium", assignee: "maya", dueOffset: 6, labels: ["content"], createdDaysAgo: 15, comments: [{ author: "maya", body: "Atlas, Meridian, and one research piece. That is the honest range.", daysAgo: 3, hour: 12 }] },
  { project: "p-portfolio", title: "Rewrite the about page", description: "Short, specific, no adjectives that could belong to anyone else.", status: "todo", priority: "low", assignee: "maya", dueOffset: 12, labels: ["content"], createdDaysAgo: 12 },
  { project: "p-portfolio", title: "Update the visual index", description: "New thumbnails, consistent crops, and alt text that describes the work.", status: "done", priority: "medium", assignee: "maya", dueOffset: null, labels: ["design"], createdDaysAgo: 18, completedDaysAgo: 4 },

  // ── Reading & notes ──────────────────────────────────────────────────────
  { project: "p-reading", title: "Finish “The Design of Everyday Things”", description: "Two chapters left, with notes on affordances that still hold up.", status: "in_progress", priority: "low", assignee: "maya", dueOffset: 10, labels: ["research"], createdDaysAgo: 30 },
  { project: "p-reading", title: "Summarise notes on calm technology", description: "One page: what calm means in a work tool, and what it does not mean.", status: "todo", priority: "low", assignee: "maya", dueOffset: 20, labels: ["research", "content"], createdDaysAgo: 24 },
];

interface DemoEvent {
  workspace: string;
  project: string | null;
  title: string;
  description: string;
  type: "meeting" | "deadline" | "milestone" | "focus";
  dayOffset: number;
  startHour?: number;
  startMinute?: number;
  durationMinutes?: number;
  allDay?: boolean;
  attendees: string[];
  location?: string;
}

const DEMO_EVENTS: DemoEvent[] = [
  { workspace: "ws-studio", project: null, title: "Weekly studio sync", description: "One round of what shipped, what is stuck, and what needs a decision this week. Fifteen minutes, standing.", type: "meeting", dayOffset: 0, startHour: 9, startMinute: 30, durationMinutes: 45, attendees: ["maya", "elias", "priya", "tomas", "noor", "kenji", "amara", "lena"], location: "Studio room · Zoom" },
  { workspace: "ws-studio", project: "p-atlas", title: "Atlas critique", description: "Bring work in progress, not presentations. Focus on the density states and empty screens.", type: "meeting", dayOffset: 1, startHour: 14, durationMinutes: 60, attendees: ["maya", "tomas", "priya", "noor"], location: "Crit room" },
  { workspace: "ws-studio", project: "p-atlas", title: "Focus · Atlas writing", description: "No meetings. Writing the motion and density guidance end to end.", type: "focus", dayOffset: 2, startHour: 9, durationMinutes: 180, attendees: ["maya"], location: "Deep work" },
  { workspace: "ws-studio", project: null, title: "1:1 · Elias", description: "Platform health, the launch window, and what to cut before it hurts.", type: "meeting", dayOffset: 3, startHour: 11, durationMinutes: 30, attendees: ["maya", "elias"], location: "Coffee bar" },
  { workspace: "ws-studio", project: "p-meridian", title: "Meridian launch review", description: "Final go / no-go. Store assets, crash rate, rollback plan, support coverage.", type: "milestone", dayOffset: 4, startHour: 16, durationMinutes: 45, attendees: ["maya", "elias", "priya", "kenji", "lena", "amara"], location: "Studio room" },
  { workspace: "ws-studio", project: "p-quiet", title: "Quiet hours workshop", description: "Prototypes on the table; decide the default window and the escalation path.", type: "meeting", dayOffset: 5, startHour: 13, durationMinutes: 90, attendees: ["maya", "noor", "amara", "tomas"], location: "Workshop 2" },
  { workspace: "ws-studio", project: "p-northwind", title: "Northwind research deadline", description: "Funnel map, interviews and metrics proposal due.", type: "deadline", dayOffset: 7, allDay: true, attendees: ["maya", "noor", "amara", "tomas"] },
  { workspace: "ws-studio", project: null, title: "Sprint 14 retro", description: "What we will stop doing, stated plainly.", type: "meeting", dayOffset: -2, startHour: 16, durationMinutes: 45, attendees: ["maya", "elias", "priya", "tomas", "noor", "kenji", "amara", "lena"], location: "Studio room" },
  { workspace: "ws-halcyon", project: "p-signal", title: "Signal readout", description: "Week-one findings, hypothesis tree, and the decision on week two.", type: "milestone", dayOffset: 9, startHour: 15, durationMinutes: 60, attendees: ["maya", "priya", "kenji"], location: "Halcyon lab" },
  { workspace: "ws-personal", project: "p-portfolio", title: "Portfolio publish", description: "Ship the three case studies and the new about page.", type: "deadline", dayOffset: 20, allDay: true, attendees: ["maya"] },
];

interface DemoConversation {
  workspace: string;
  kind: "direct" | "group";
  name: string | null;
  project: string | null;
  participants: string[];
  /** [author, body, daysAgo, hour, minute] */
  messages: Array<{ author: string; body: string; daysAgo: number; hour: number; minute: number }>;
  /** Per-participant last read offset/hour — controls who has unread messages. */
  reads: Record<string, { daysAgo: number; hour: number; minute: number }>;
}

const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    workspace: "ws-studio", kind: "group", name: "Atlas design language", project: "p-atlas",
    participants: ["maya", "tomas", "priya", "noor"],
    messages: [
      { author: "maya", body: "Density work is close. Compact should remove padding, never type size.", daysAgo: 3, hour: 9, minute: 12 },
      { author: "tomas", body: "Agreed — table rows at 34px compact, 44px comfortable, identical type scale.", daysAgo: 2, hour: 14, minute: 5 },
      { author: "priya", body: "Pushed the token change. One visual diff in the calendar slot heights — flagged for review.", daysAgo: 1, hour: 14, minute: 5 },
    ],
    reads: { maya: { daysAgo: 2, hour: 9, minute: 0 }, tomas: { daysAgo: 1, hour: 18, minute: 0 }, priya: { daysAgo: 1, hour: 18, minute: 0 }, noor: { daysAgo: 1, hour: 18, minute: 0 } },
  },
  {
    workspace: "ws-studio", kind: "group", name: "Meridian launch", project: "p-meridian",
    participants: ["maya", "elias", "priya", "kenji", "amara"],
    messages: [
      { author: "elias", body: "Go/no-go is Thursday. Crash rate is the only red item.", daysAgo: 2, hour: 10, minute: 15 },
      { author: "kenji", body: "Draft conflicts fix is in review. I would not ship before it lands.", daysAgo: 1, hour: 15, minute: 30 },
    ],
    reads: { maya: { daysAgo: 2, hour: 12, minute: 0 }, elias: { daysAgo: 1, hour: 18, minute: 0 }, priya: { daysAgo: 1, hour: 18, minute: 0 }, kenji: { daysAgo: 1, hour: 18, minute: 0 }, amara: { daysAgo: 1, hour: 18, minute: 0 } },
  },
  {
    workspace: "ws-studio", kind: "group", name: "Studio leads", project: null,
    participants: ["maya", "elias", "amara"],
    messages: [
      { author: "amara", body: "Weekly rhythm doc is ready for comments.", daysAgo: 4, hour: 11, minute: 0 },
    ],
    reads: { maya: { daysAgo: 4, hour: 12, minute: 0 }, elias: { daysAgo: 4, hour: 12, minute: 0 }, amara: { daysAgo: 4, hour: 12, minute: 0 } },
  },
  {
    workspace: "ws-studio", kind: "direct", name: null, project: null,
    participants: ["maya", "elias"], messages: [],
    reads: { maya: { daysAgo: 0, hour: 8, minute: 0 }, elias: { daysAgo: 0, hour: 8, minute: 0 } },
  },
  {
    workspace: "ws-studio", kind: "direct", name: null, project: null,
    participants: ["maya", "priya"],
    messages: [
      { author: "priya", body: "Paired on the board padding token — it is the wrong variable. Fixing now.", daysAgo: 1, hour: 9, minute: 15 },
    ],
    reads: { maya: { daysAgo: 3, hour: 9, minute: 0 }, priya: { daysAgo: 1, hour: 9, minute: 20 } },
  },
];

interface DemoNotification {
  workspace: string;
  recipient: string;
  category: "task" | "project" | "team" | "mention" | "system";
  title: string;
  body: string;
  href: string | null;
  daysAgo: number;
  hour: number;
  minute?: number;
  read: boolean;
}

const DEMO_NOTIFICATIONS: DemoNotification[] = [
  { workspace: "ws-studio", recipient: "maya", category: "task", title: "Priya assigned you a task", body: "Map the current onboarding funnel · Northwind onboarding", href: "/tasks", daysAgo: 0, hour: 8, minute: 40, read: false },
  { workspace: "ws-studio", recipient: "maya", category: "mention", title: "Tomás mentioned you in Atlas design language", body: "“Updated the Figma with both densities. The empty cells read much better…”", href: "/messages", daysAgo: 0, hour: 8, minute: 12, read: false },
  { workspace: "ws-studio", recipient: "maya", category: "task", title: "Crash on Android 13 launch is overdue", body: "Owned by Elias Moreau · Meridian mobile app", href: "/tasks", daysAgo: 1, hour: 17, minute: 5, read: false },
  { workspace: "ws-studio", recipient: "maya", category: "project", title: "Audit contrast in Graphite moved to in review", body: "Waiting on Lena Fischer · Atlas design language", href: "/projects", daysAgo: 1, hour: 16, minute: 20, read: false },
  { workspace: "ws-studio", recipient: "maya", category: "team", title: "Lena Fischer joined Nexus Studio", body: "QA Engineer · Berlin, DE", href: "/team", daysAgo: 2, hour: 10, minute: 0, read: true },
  { workspace: "ws-studio", recipient: "maya", category: "system", title: "Workspace seeded", body: "This development workspace was created by the demo seed script.", href: "/settings", daysAgo: 3, hour: 9, minute: 0, read: true },
  { workspace: "ws-studio", recipient: "maya", category: "project", title: "Meridian launch review scheduled", body: "Thursday · 16:00 · Studio room", href: "/calendar", daysAgo: 3, hour: 11, minute: 0, read: true },
  { workspace: "ws-halcyon", recipient: "maya", category: "mention", title: "Priya shared an early signal", body: "“Teams notice the problem in standup, not dashboards.”", href: "/messages", daysAgo: 1, hour: 11, minute: 5, read: false },
  { workspace: "ws-halcyon", recipient: "maya", category: "task", title: "Signal readout needs a date", body: "Schedule the readout · Signal research programme", href: "/tasks", daysAgo: 2, hour: 12, minute: 0, read: true },
  { workspace: "ws-personal", recipient: "maya", category: "task", title: "Portfolio publish is in 20 days", body: "Three case studies and the about page still open", href: "/projects", daysAgo: 0, hour: 7, minute: 30, read: false },
  // Per-recipient demonstration rows (Decision D8): notifications target one user.
  { workspace: "ws-studio", recipient: "elias", category: "task", title: "Amara assigned you a task", body: "Instrument the sync engine · Meridian mobile app", href: "/tasks", daysAgo: 1, hour: 9, minute: 30, read: false },
  { workspace: "ws-halcyon", recipient: "priya", category: "mention", title: "Maya mentioned you in Signal research programme", body: "“Can you bring the cohort numbers to the readout?”", href: "/messages", daysAgo: 2, hour: 9, minute: 0, read: false },
];

interface DemoActivity {
  workspace: string;
  actor: string;
  kind:
    | "project.created" | "project.updated" | "project.completed"
    | "task.created" | "task.updated" | "task.completed" | "task.assigned"
    | "comment.created" | "event.created" | "member.joined";
  entityType: "project" | "task" | "event";
  /** Reference into the seeded entities: "task:<key>" | "project:<key>" | "event:<index>". */
  entity: string;
  entityLabel: string;
  project: string | null;
  daysAgo: number;
  hour: number;
  minute: number;
}

const DEMO_ACTIVITY: DemoActivity[] = [
  { workspace: "ws-studio", actor: "priya", kind: "task.updated", entityType: "task", entity: "task:Implement the shell primitives", entityLabel: "Implement the shell primitives", project: "p-atlas", daysAgo: 0, hour: 9, minute: 12 },
  { workspace: "ws-studio", actor: "elias", kind: "task.updated", entityType: "task", entity: "task:Crash on Android 13 launch", entityLabel: "Crash on Android 13 launch", project: "p-meridian", daysAgo: 0, hour: 8, minute: 58 },
  { workspace: "ws-studio", actor: "lena", kind: "comment.created", entityType: "task", entity: "task:Crash on Android 13 launch", entityLabel: "Crash on Android 13 launch", project: "p-meridian", daysAgo: 1, hour: 17, minute: 30 },
  { workspace: "ws-studio", actor: "tomas", kind: "task.updated", entityType: "task", entity: "task:Design the data-density states", entityLabel: "Design the data-density states", project: "p-atlas", daysAgo: 1, hour: 16, minute: 18 },
  { workspace: "ws-studio", actor: "amara", kind: "task.completed", entityType: "task", entity: "task:Define the launch checklist", entityLabel: "Define the launch checklist", project: "p-meridian", daysAgo: 2, hour: 15, minute: 40 },
  { workspace: "ws-studio", actor: "maya", kind: "event.created", entityType: "event", entity: "event:Quiet hours workshop", entityLabel: "Quiet hours workshop", project: "p-quiet", daysAgo: 2, hour: 11, minute: 5 },
  { workspace: "ws-studio", actor: "tomas", kind: "task.updated", entityType: "task", entity: "task:Storyboard the first-run journey", entityLabel: "Storyboard the first-run journey", project: "p-northwind", daysAgo: 2, hour: 10, minute: 20 },
  { workspace: "ws-studio", actor: "noor", kind: "comment.created", entityType: "task", entity: "task:Redesign the empty inbox", entityLabel: "Redesign the empty inbox", project: "p-meridian", daysAgo: 3, hour: 14, minute: 50 },
  { workspace: "ws-studio", actor: "lena", kind: "task.completed", entityType: "task", entity: "task:Test push notification permissions", entityLabel: "Test push notification permissions", project: "p-meridian", daysAgo: 5, hour: 16, minute: 10 },
  { workspace: "ws-studio", actor: "maya", kind: "project.updated", entityType: "project", entity: "project:p-northwind", entityLabel: "Northwind onboarding", project: "p-northwind", daysAgo: 6, hour: 9, minute: 35 },
  { workspace: "ws-studio", actor: "maya", kind: "project.completed", entityType: "project", entity: "project:p-helios", entityLabel: "Helios site redesign", project: "p-helios", daysAgo: 18, hour: 17, minute: 0 },
  { workspace: "ws-studio", actor: "lena", kind: "task.completed", entityType: "task", entity: "task:Final accessibility sign-off", entityLabel: "Final accessibility sign-off", project: "p-helios", daysAgo: 18, hour: 15, minute: 20 },
  { workspace: "ws-halcyon", actor: "priya", kind: "comment.created", entityType: "task", entity: "task:Recruit interview cohort", entityLabel: "Recruit interview cohort", project: "p-signal", daysAgo: 0, hour: 9, minute: 5 },
  { workspace: "ws-halcyon", actor: "kenji", kind: "task.updated", entityType: "task", entity: "task:Build the analysis notebook", entityLabel: "Build the analysis notebook", project: "p-signal", daysAgo: 1, hour: 14, minute: 12 },
  { workspace: "ws-halcyon", actor: "maya", kind: "project.created", entityType: "project", entity: "project:p-ember", entityLabel: "Ember prototype", project: "p-ember", daysAgo: 8, hour: 10, minute: 0 },
  { workspace: "ws-halcyon", actor: "maya", kind: "task.completed", entityType: "task", entity: "task:Define the hypothesis tree", entityLabel: "Define the hypothesis tree", project: "p-signal", daysAgo: 9, hour: 12, minute: 30 },
  { workspace: "ws-personal", actor: "maya", kind: "task.completed", entityType: "task", entity: "task:Update the visual index", entityLabel: "Update the visual index", project: "p-portfolio", daysAgo: 4, hour: 18, minute: 40 },
  { workspace: "ws-personal", actor: "maya", kind: "project.updated", entityType: "project", entity: "project:p-portfolio", entityLabel: "Portfolio refresh", project: "p-portfolio", daysAgo: 4, hour: 18, minute: 42 },
];

/* -------------------------------------------------------------------------- */
/* Seed implementation                                                        */
/* -------------------------------------------------------------------------- */

const TRUNCATE_TABLES = [
  "uploads", "activities", "notifications", "messages", "conversation_members",
  "conversations", "event_attendees", "calendar_events", "attachments", "comments",
  "subtasks", "task_labels", "tasks", "labels", "project_members", "projects",
  "invitations", "workspace_members", "workspaces", "user_preferences",
  "sessions", "verification_tokens", "users",
] as const;

export interface SeedResult {
  users: number;
  workspaces: number;
  workspaceMembers: number;
  projects: number;
  projectMembers: number;
  labels: number;
  tasks: number;
  subtasks: number;
  comments: number;
  attachments: number;
  events: number;
  eventAttendees: number;
  conversations: number;
  conversationMembers: number;
  messages: number;
  notifications: number;
  activities: number;
  preferences: number;
}

async function insertReturningId(
  client: PoolClient,
  sql: string,
  params: readonly unknown[],
): Promise<string> {
  const result = await client.query<{ id: string }>(`${sql} RETURNING id`, params as unknown[]);
  const row = result.rows[0];
  if (!row) throw new Error(`Seed insert returned no id for: ${sql.split("LIMIT")[0]}`);
  return row.id;
}

function must<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Seed reference missing: ${key}`);
  return value;
}

export async function seedDemoData(
  options: { env?: Env; fresh?: boolean } = {},
): Promise<SeedResult> {
  const env = options.env ?? getEnv();
  const fresh = options.fresh ?? false;

  if (env.nodeEnv === "production") {
    throw new Error(
      "Refusing to seed demo data: NODE_ENV=production. Demo accounts carry predictable credentials and must never exist in production.",
    );
  }

  const logger: Logger = createLogger(env);
  const pool = createDatabasePool(env, logger);

  try {
    // Ensure the schema exists (idempotent, advisory-locked).
    await runMigrations(pool, logger);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (fresh) {
        await client.query(`TRUNCATE TABLE ${TRUNCATE_TABLES.join(", ")} CASCADE`);
        logger.warn("existing demo data truncated (--fresh)");
      } else {
        const existing = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
        if (existing.rows[0] && existing.rows[0].count !== "0") {
          throw new Error("Database already contains users. Re-run with --fresh to replace demo data.");
        }
      }

      const passwordHash = await hashPassword(env.demoPassword);

      /* ----------------------------- users -------------------------------- */
      const userIds = new Map<string, string>();
      for (const user of DEMO_USERS) {
        const id = await insertReturningId(
          client,
          `INSERT INTO users (email, password_hash, name, title, bio, location, timezone, avatar_hue, email_verified_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [user.email, passwordHash, user.name, user.title, user.bio, user.location, user.timezone, user.avatarHue, at(-120, 9), at(-140, 9)],
        );
        userIds.set(user.key, id);
      }

      /* --------------------------- workspaces ----------------------------- */
      const workspaceIds = new Map<string, string>();
      let workspaceMemberCount = 0;
      for (const workspace of DEMO_WORKSPACES) {
        const id = await insertReturningId(
          client,
          `INSERT INTO workspaces (name, slug, plan, description, accent_hue, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [workspace.name, workspace.slug, workspace.plan, workspace.description, workspace.accentHue, must(userIds, "maya"), at(-150, 9)],
        );
        workspaceIds.set(workspace.key, id);

        for (const member of workspace.members) {
          await client.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)`,
            [id, must(userIds, member.user), member.role, at(-140, 9)],
          );
          workspaceMemberCount += 1;
        }

        // Preferences for every demo user (mirrors defaultPreferences); Maya's
        // active workspace points at the studio workspace.
        for (const member of workspace.members) {
          await client.query(
            `INSERT INTO user_preferences (user_id, density, reduce_motion, start_of_week, email_digest,
               notify_task_assigned, notify_comments_mentions, notify_due_date_reminders, notify_project_updates, active_workspace_id)
             VALUES ($1, 'comfortable', false, 1, true, true, true, true, false, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [must(userIds, member.user), workspace.key === "ws-studio" ? id : null],
          );
        }
      }
      const preferenceCount = DEMO_USERS.length;

      /* ------------------------------ labels ------------------------------ */
      const labelsByWorkspace = new Map<string, Map<string, string>>();
      let labelCount = 0;
      for (const workspace of DEMO_WORKSPACES) {
        const workspaceId = must(workspaceIds, workspace.key);
        const labelIds = new Map<string, string>();
        for (const label of DEMO_LABELS) {
          const labelId = await insertReturningId(
            client,
            `INSERT INTO labels (workspace_id, name, hue, created_at) VALUES ($1, $2, $3, $4)`,
            [workspaceId, label.name, label.hue, at(-150, 9)],
          );
          labelIds.set(label.name, labelId);
          labelCount += 1;
        }
        labelsByWorkspace.set(workspace.key, labelIds);
      }

      /* ----------------------------- projects ----------------------------- */
      const projectIds = new Map<string, string>();
      let projectMemberCount = 0;
      for (const project of DEMO_PROJECTS) {
        const workspaceId = must(workspaceIds, project.workspace);
        const id = await insertReturningId(
          client,
          `INSERT INTO projects (workspace_id, name, key, description, status, priority, color_hue, start_date, due_date, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            workspaceId, project.name, project.shortKey, project.description, project.status, project.priority,
            project.colorHue, at(project.startOffset, 9), at(project.dueOffset, 17), must(userIds, "maya"),
            at(-project.createdDaysAgo, 9), at(-project.updated.daysAgo, project.updated.hour),
          ],
        );
        projectIds.set(project.key, id);

        for (const member of project.members) {
          await client.query(
            `INSERT INTO project_members (project_id, user_id, joined_at) VALUES ($1, $2, $3)`,
            [id, must(userIds, member), at(-project.createdDaysAgo, 9)],
          );
          projectMemberCount += 1;
        }
      }

      /* ------------------------------ tasks ------------------------------- */
      const projectsByKey = new Map<string, DemoProject>(DEMO_PROJECTS.map((project) => [project.key, project]));
      const taskIdsByTitle = new Map<string, string>();
      const columnCounters = new Map<string, number>();
      let subtaskCount = 0;
      let commentCount = 0;
      let attachmentCount = 0;

      for (const task of DEMO_TASKS) {
        const project = must(projectsByKey, task.project);
        const workspaceId = must(workspaceIds, project.workspace);
        const projectId = must(projectIds, project.key);

        const columnKey = `${project.workspace}:${task.status}`;
        const order = (columnCounters.get(columnKey) ?? 0) + 1;
        columnCounters.set(columnKey, order);

        const createdAt = at(-task.createdDaysAgo, 9);
        const completedAt = task.completedDaysAgo !== undefined ? at(-task.completedDaysAgo, 15) : null;
        const taskId = await insertReturningId(
          client,
          `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, reporter_id, due_date, sort_order, completed_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            workspaceId, projectId, task.title, task.description, task.status, task.priority,
            task.assignee ? must(userIds, task.assignee) : null, must(userIds, "maya"),
            task.dueOffset !== null ? at(task.dueOffset, 17) : null, order, completedAt,
            createdAt, completedAt ?? createdAt,
          ],
        );
        taskIdsByTitle.set(task.title, taskId);

        const workspaceLabels = must(labelsByWorkspace, project.workspace);
        for (const labelName of task.labels) {
          await client.query(
            `INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)`,
            [taskId, must(workspaceLabels, labelName)],
          );
        }

        for (const [index, subtask] of (task.subtasks ?? []).entries()) {
          await client.query(
            `INSERT INTO subtasks (task_id, title, done, sort_order, created_at) VALUES ($1, $2, $3, $4, $5)`,
            [taskId, subtask.title, subtask.done, index, createdAt],
          );
          subtaskCount += 1;
        }

        for (const comment of task.comments ?? []) {
          await client.query(
            `INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)`,
            [taskId, must(userIds, comment.author), comment.body, at(-comment.daysAgo, comment.hour, comment.minute ?? 0)],
          );
          commentCount += 1;
        }

        for (const attachment of task.attachments ?? []) {
          await client.query(
            `INSERT INTO attachments (task_id, uploaded_by, name, size_bytes, mime_type, uploaded_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [taskId, must(userIds, "maya"), attachment.name, attachment.sizeBytes, attachment.mimeType, at(-2, 12)],
          );
          attachmentCount += 1;
        }
      }

      /* --------------------------- attachments ---------------------------- */
      // The frontend placeholder trio (task-attachments.tsx) as real metadata
      // rows; storage_key stays NULL until Phase 6 introduces byte storage.
      const attachmentSpecs = [
        { task: "Implement the shell primitives", name: "brief.pdf", sizeBytes: 428_000, mimeType: "application/pdf" },
        { task: "Redesign the empty inbox", name: "notes.md", sizeBytes: 12_600, mimeType: "text/markdown" },
        { task: "Select the case studies", name: "reference.png", sizeBytes: 1_840_000, mimeType: "image/png" },
      ];
      for (const spec of attachmentSpecs) {
        await client.query(
          `INSERT INTO attachments (task_id, uploaded_by, name, size_bytes, mime_type, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [must(taskIdsByTitle, spec.task), must(userIds, "maya"), spec.name, spec.sizeBytes, spec.mimeType, at(-2, 12)],
        );
        attachmentCount += 1;
      }

      /* ------------------------------ events ------------------------------ */
      const eventIdsByTitle = new Map<string, string>();
      let eventAttendeeCount = 0;
      for (const event of DEMO_EVENTS) {
        const workspaceId = must(workspaceIds, event.workspace);
        const startHour = event.startHour ?? 9;
        const startMinute = event.startMinute ?? 0;
        const start = event.allDay ? at(event.dayOffset, 0, 0) : at(event.dayOffset, startHour, startMinute);
        const end = event.allDay ? at(event.dayOffset, 23, 59) : new Date(start.getTime() + (event.durationMinutes ?? 60) * 60_000);
        const eventId = await insertReturningId(
          client,
          `INSERT INTO calendar_events (workspace_id, project_id, title, description, type, start_at, end_at, all_day, location, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
          [
            workspaceId, event.project ? must(projectIds, event.project) : null, event.title, event.description,
            event.type, start, end, event.allDay ?? false, event.location ?? "", must(userIds, "maya"),
            at(event.dayOffset - 14, 10),
          ],
        );
        eventIdsByTitle.set(event.title, eventId);

        for (const attendee of event.attendees) {
          await client.query(
            `INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)`,
            [eventId, must(userIds, attendee)],
          );
          eventAttendeeCount += 1;
        }
      }

      /* --------------------------- conversations -------------------------- */
      let conversationMemberCount = 0;
      let messageCount = 0;
      for (const conversation of DEMO_CONVERSATIONS) {
        const workspaceId = must(workspaceIds, conversation.workspace);
        const participantIds = conversation.participants.map((participant) => must(userIds, participant));
        const directKey =
          conversation.kind === "direct"
            ? [workspaceId, ...participantIds].sort().join(":")
            : null;

        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const lastMessageAt = lastMessage ? at(-lastMessage.daysAgo, lastMessage.hour, lastMessage.minute) : null;

        const conversationId = await insertReturningId(
          client,
          `INSERT INTO conversations (workspace_id, kind, name, project_id, direct_key, created_by, last_message_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
          [
            workspaceId, conversation.kind, conversation.name,
            conversation.project ? must(projectIds, conversation.project) : null,
            directKey, must(userIds, "maya"), lastMessageAt, at(-14, 9),
          ],
        );

        for (const participant of conversation.participants) {
          const read = conversation.reads[participant];
          if (!read) throw new Error(`Conversation ${conversation.name ?? conversation.kind} missing read state for ${participant}`);
          await client.query(
            `INSERT INTO conversation_members (conversation_id, user_id, last_read_at, joined_at) VALUES ($1, $2, $3, $4)`,
            [conversationId, must(userIds, participant), at(-read.daysAgo, read.hour, read.minute), at(-14, 9)],
          );
          conversationMemberCount += 1;
        }

        for (const message of conversation.messages) {
          await client.query(
            `INSERT INTO messages (conversation_id, author_id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)`,
            [conversationId, must(userIds, message.author), message.body, at(-message.daysAgo, message.hour, message.minute)],
          );
          messageCount += 1;
        }
      }

      /* --------------------------- notifications -------------------------- */
      let notificationCount = 0;
      for (const notification of DEMO_NOTIFICATIONS) {
        await client.query(
          `INSERT INTO notifications (workspace_id, user_id, category, title, body, href, read_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            must(workspaceIds, notification.workspace), must(userIds, notification.recipient), notification.category,
            notification.title, notification.body, notification.href,
            notification.read ? at(-notification.daysAgo, notification.hour, notification.minute ?? 0) : null,
            at(-notification.daysAgo, notification.hour, notification.minute ?? 0),
          ],
        );
        notificationCount += 1;
      }

      /* ----------------------------- activities --------------------------- */
      let activityCount = 0;
      for (const activity of DEMO_ACTIVITY) {
        const entityId = activity.entity.startsWith("task:")
          ? must(taskIdsByTitle, activity.entity.slice("task:".length))
          : activity.entity.startsWith("project:")
            ? must(projectIds, activity.entity.slice("project:".length))
            : must(eventIdsByTitle, activity.entity.slice("event:".length));

        await client.query(
          `INSERT INTO activities (workspace_id, actor_id, kind, entity_type, entity_id, entity_label, project_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            must(workspaceIds, activity.workspace), must(userIds, activity.actor), activity.kind,
            activity.entityType, entityId, activity.entityLabel,
            activity.project ? must(projectIds, activity.project) : null,
            at(-activity.daysAgo, activity.hour, activity.minute),
          ],
        );
        activityCount += 1;
      }

      await client.query("COMMIT");

      const result: SeedResult = {
        users: DEMO_USERS.length,
        workspaces: DEMO_WORKSPACES.length,
        workspaceMembers: workspaceMemberCount,
        projects: DEMO_PROJECTS.length,
        projectMembers: projectMemberCount,
        labels: labelCount,
        tasks: DEMO_TASKS.length,
        subtasks: subtaskCount,
        comments: commentCount,
        attachments: attachmentCount,
        events: DEMO_EVENTS.length,
        eventAttendees: eventAttendeeCount,
        conversations: DEMO_CONVERSATIONS.length,
        conversationMembers: conversationMemberCount,
        messages: messageCount,
        notifications: notificationCount,
        activities: activityCount,
        preferences: preferenceCount,
      };
      logger.info(result, "demo seed complete");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

/* ------------------------------- CLI entry ------------------------------- */

async function main(): Promise<void> {
  const fresh = process.argv.includes("--fresh");
  const result = await seedDemoData({ fresh });
  console.log("Demo seed complete:", JSON.stringify(result, null, 2));
  console.log(`\nDemo login: any seeded email (e.g. maya@nexus.studio) with password from DEMO_PASSWORD (default "nexus-demo-2026").`);
  console.log("WARNING: demo credentials only — the seed refuses to run when NODE_ENV=production.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
