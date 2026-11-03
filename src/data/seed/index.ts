import type { PersistedState, Preferences } from "@/types/domain";
import { CURRENT_USER_ID, DEFAULT_WORKSPACE_ID, seedMembers, seedWorkspaces } from "@/data/seed/shell";
import { seedProjects } from "@/data/seed/projects";
import { seedTasks } from "@/data/seed/tasks";
import { seedEvents } from "@/data/seed/events";
import { seedConversations } from "@/data/seed/conversations";
import { seedNotifications } from "@/data/seed/notifications";
import { seedActivity } from "@/data/seed/activity";

export const DATA_VERSION = 1;

export const defaultPreferences: Preferences = {
  density: "comfortable",
  reduceMotion: false,
  startOfWeek: 1,
  emailDigest: true,
  taskAssigned: true,
  commentsMentions: true,
  dueDateReminders: true,
  projectUpdates: false,
};

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/**
 * Builds a fresh, complete demo dataset. Every module reads from the persisted
 * store, so this is the single place that decides what the demo contains.
 */
export function createSeedState(): PersistedState {
  return {
    version: DATA_VERSION,
    workspaces: byId(seedWorkspaces),
    members: byId(seedMembers),
    projects: byId(seedProjects),
    tasks: byId(seedTasks),
    events: byId(seedEvents),
    conversations: byId(seedConversations),
    notifications: byId(seedNotifications),
    activity: byId(seedActivity),
    activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    currentUserId: CURRENT_USER_ID,
    preferences: { ...defaultPreferences },
  };
}

export { seedWorkspaces, seedMembers, seedProjects, seedTasks, seedEvents };
