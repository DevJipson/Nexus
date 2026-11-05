"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSeedState, DATA_VERSION } from "@/data/seed";
import type {
  ActivityEntry,
  Attachment,
  CalendarEvent,
  CalendarEventType,
  Conversation,
  ID,
  PersistedState,
  Preferences,
  Priority,
  Project,
  ProjectStatus,
  Task,
  TaskLabel,
  TaskStatus,
  Workspace,
} from "@/types/domain";

let sequence = 0;
function uid(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  dueDate: string;
  memberIds: ID[];
}

export interface CreateTaskInput {
  projectId: ID;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: ID | null;
  dueDate?: string | null;
  labels?: TaskLabel[];
}

export interface CreateEventInput {
  title: string;
  description: string;
  type: CalendarEventType;
  projectId: ID | null;
  start: string;
  end: string;
  allDay: boolean;
  attendeeIds: ID[];
  location: string;
}

export interface CreateConversationInput {
  kind: "direct" | "group";
  name: string | null;
  participantIds: ID[];
  projectId: ID | null;
  firstMessage?: string;
}

export interface ProfilePatch {
  name: string;
  title: string;
  email: string;
  bio: string;
  location: string;
  timezone: string;
}

type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "status"
    | "priority"
    | "assigneeId"
    | "dueDate"
    | "labels"
    | "projectId"
  >
>;

type EventPatch = Partial<
  Pick<
    CalendarEvent,
    "title" | "description" | "type" | "projectId" | "start" | "end" | "allDay" | "attendeeIds" | "location"
  >
>;

type ProjectPatch = Partial<
  Pick<Project, "name" | "description" | "status" | "priority" | "dueDate" | "memberIds" | "colorHue">
>;

interface WorkspaceActions {
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setActiveWorkspaceId: (id: ID) => void;
  resetDemoData: () => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  updateProfile: (patch: ProfilePatch) => void;
  updateWorkspace: (id: ID, patch: Partial<Pick<Workspace, "name" | "description">>) => void;
  createProject: (input: CreateProjectInput) => Project;
  updateProject: (id: ID, patch: ProjectPatch) => void;
  deleteProject: (id: ID) => void;
  createTask: (input: CreateTaskInput) => Task;
  updateTask: (id: ID, patch: TaskPatch) => void;
  moveTask: (id: ID, status: TaskStatus, index?: number) => void;
  deleteTask: (id: ID) => void;
  addSubtask: (taskId: ID, title: string) => void;
  deleteSubtask: (taskId: ID, subtaskId: ID) => void;
  toggleSubtask: (taskId: ID, subtaskId: ID) => void;
  addComment: (taskId: ID, authorId: ID, body: string) => void;
  addAttachment: (taskId: ID, input: Omit<Attachment, "id" | "uploadedAt">) => void;
  deleteAttachment: (taskId: ID, attachmentId: ID) => void;
  createEvent: (input: CreateEventInput) => CalendarEvent;
  updateEvent: (id: ID, patch: EventPatch) => void;
  deleteEvent: (id: ID) => void;
  sendMessage: (conversationId: ID, authorId: ID, body: string) => void;
  markConversationRead: (conversationId: ID) => void;
  createConversation: (input: CreateConversationInput) => Conversation;
  markNotificationRead: (id: ID) => void;
  markAllNotificationsRead: (workspaceId: ID) => void;
}

export type WorkspaceStore = PersistedState & WorkspaceActions;

function logActivity(
  state: WorkspaceStore,
  input: {
    kind: ActivityEntry["kind"];
    entityType: ActivityEntry["entityType"];
    entityId: ID;
    entityLabel: string;
    projectId: ID | null;
    actorId?: ID;
    createdAt?: string;
  },
): ActivityEntry {
  return {
    id: uid("a"),
    workspaceId: state.activeWorkspaceId,
    actorId: input.actorId ?? state.currentUserId,
    kind: input.kind,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    projectId: input.projectId,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function projectKey(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  return (letters.slice(0, 3) || "PRJ").toUpperCase();
}

const initial = createSeedState();

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...initial,
      hydrated: false,

      setHydrated: (hydrated) => set({ hydrated }),

      setActiveWorkspaceId: (id) => {
        const state = get();
        if (!state.workspaces[id]) return;
        set({ activeWorkspaceId: id });
      },

      resetDemoData: () => {
        const seeded = createSeedState();
        set({ ...seeded, hydrated: get().hydrated });
      },

      updatePreferences: (patch) =>
        set((state) => ({ preferences: { ...state.preferences, ...patch } })),

      updateProfile: (patch) =>
        set((state) => {
          const current = state.members[state.currentUserId];
          if (!current) return state;
          return {
            members: {
              ...state.members,
              [state.currentUserId]: { ...current, ...patch },
            },
          };
        }),

      updateWorkspace: (id, patch) =>
        set((state) => {
          const workspace = state.workspaces[id];
          if (!workspace) return state;
          return {
            workspaces: {
              ...state.workspaces,
              [id]: { ...workspace, ...patch },
            },
          };
        }),

      createProject: (input) => {
        const state = get();
        const now = new Date().toISOString();
        const project: Project = {
          id: uid("p"),
          workspaceId: state.activeWorkspaceId,
          name: input.name,
          key: projectKey(input.name),
          description: input.description,
          status: input.status,
          priority: input.priority,
          colorHue: 264,
          startDate: now,
          dueDate: input.dueDate,
          memberIds: input.memberIds.length ? input.memberIds : [state.currentUserId],
          createdAt: now,
          updatedAt: now,
        };
        const entry = logActivity(state, {
          kind: "project.created",
          entityType: "project",
          entityId: project.id,
          entityLabel: project.name,
          projectId: project.id,
        });

        set((current) => ({
          projects: { ...current.projects, [project.id]: project },
          activity: { ...current.activity, [entry.id]: entry },
        }));
        return project;
      },

      updateProject: (id, patch) =>
        set((state) => {
          const project = state.projects[id];
          if (!project) return state;
          const updated: Project = {
            ...project,
            ...patch,
            updatedAt: new Date().toISOString(),
          };
          const entry = logActivity(state, {
            kind: "project.updated",
            entityType: "project",
            entityId: id,
            entityLabel: updated.name,
            projectId: id,
          });
          return {
            projects: { ...state.projects, [id]: updated },
            activity: { ...state.activity, [entry.id]: entry },
          };
        }),

      deleteProject: (id) =>
        set((state) => {
          if (!state.projects[id]) return state;
          const projects = { ...state.projects };
          delete projects[id];

          const tasks = { ...state.tasks };
          for (const task of Object.values(tasks)) {
            if (task.projectId === id) delete tasks[task.id];
          }

          const conversations = { ...state.conversations };
          for (const conversation of Object.values(conversations)) {
            if (conversation.projectId === id) {
              conversations[conversation.id] = { ...conversation, projectId: null };
            }
          }

          const events = { ...state.events };
          for (const event of Object.values(events)) {
            if (event.projectId === id) events[event.id] = { ...event, projectId: null };
          }

          return { projects, tasks, conversations, events };
        }),

      createTask: (input) => {
        const state = get();
        const now = new Date().toISOString();
        const status = input.status ?? "todo";
        const maxOrder = Math.max(
          0,
          ...Object.values(state.tasks)
            .filter((task) => task.workspaceId === state.activeWorkspaceId && task.status === status)
            .map((task) => task.order),
        );

        const task: Task = {
          id: uid("t"),
          workspaceId: state.activeWorkspaceId,
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? "",
          status,
          priority: input.priority ?? "medium",
          assigneeId: input.assigneeId ?? null,
          reporterId: state.currentUserId,
          dueDate: input.dueDate ?? null,
          labels: input.labels ?? [],
          order: maxOrder + 1,
          subtasks: [],
          comments: [],
          attachments: [],
          createdAt: now,
          updatedAt: now,
          completedAt: status === "done" ? now : null,
        };

        const entry = logActivity(state, {
          kind: "task.created",
          entityType: "task",
          entityId: task.id,
          entityLabel: task.title,
          projectId: task.projectId,
        });

        const assignedEntry =
          task.assigneeId && task.assigneeId !== state.currentUserId
            ? logActivity(state, {
                kind: "task.assigned",
                entityType: "task",
                entityId: task.id,
                entityLabel: task.title,
                projectId: task.projectId,
              })
            : null;

        set((current) => ({
          tasks: { ...current.tasks, [task.id]: task },
          activity: {
            ...current.activity,
            [entry.id]: entry,
            ...(assignedEntry ? { [assignedEntry.id]: assignedEntry } : {}),
          },
          projects: current.projects[input.projectId]
            ? {
                ...current.projects,
                [input.projectId]: {
                  ...current.projects[input.projectId],
                  updatedAt: now,
                },
              }
            : current.projects,
        }));
        return task;
      },

      updateTask: (id, patch) =>
        set((state) => {
          const task = state.tasks[id];
          if (!task) return state;
          const now = new Date().toISOString();
          const status = patch.status ?? task.status;

          const updated: Task = {
            ...task,
            ...patch,
            updatedAt: now,
            completedAt:
              status === "done"
                ? (task.completedAt ?? now)
                : null,
          };

          const entry = logActivity(state, {
            kind: status === "done" && task.status !== "done" ? "task.completed" : "task.updated",
            entityType: "task",
            entityId: id,
            entityLabel: updated.title,
            projectId: updated.projectId,
          });

          return {
            tasks: { ...state.tasks, [id]: updated },
            activity: { ...state.activity, [entry.id]: entry },
          };
        }),

      moveTask: (id, status, index) =>
        set((state) => {
          const task = state.tasks[id];
          if (!task) return state;
          const now = new Date().toISOString();

          const column = Object.values(state.tasks)
            .filter(
              (item) =>
                item.id !== id &&
                item.workspaceId === task.workspaceId &&
                item.status === status,
            )
            .sort((a, b) => a.order - b.order);

          const position = index ?? column.length;
          const clamped = Math.max(0, Math.min(position, column.length));
          const ordered = [...column];
          ordered.splice(clamped, 0, task);

          const tasks = { ...state.tasks };
          ordered.forEach((item, itemIndex) => {
            tasks[item.id] = {
              ...item,
              status,
              order: itemIndex + 1,
              updatedAt: item.id === id ? now : item.updatedAt,
              completedAt:
                item.id === id
                  ? status === "done"
                    ? (item.completedAt ?? now)
                    : null
                  : item.completedAt,
            };
          });

          const entry = logActivity(state, {
            kind: status === "done" && task.status !== "done" ? "task.completed" : "task.updated",
            entityType: "task",
            entityId: id,
            entityLabel: task.title,
            projectId: task.projectId,
            createdAt: now,
          });

          return {
            tasks,
            activity: { ...state.activity, [entry.id]: entry },
          };
        }),

      deleteTask: (id) =>
        set((state) => {
          if (!state.tasks[id]) return state;
          const tasks = { ...state.tasks };
          delete tasks[id];
          return { tasks };
        }),

      addSubtask: (taskId, title) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: [...task.subtasks, { id: uid("s"), title, done: false }],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      deleteSubtask: (taskId, subtaskId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      toggleSubtask: (taskId, subtaskId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
                ),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      addComment: (taskId, authorId, body) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || !body.trim()) return state;
          const now = new Date().toISOString();
          const entry = logActivity(state, {
            kind: "comment.created",
            entityType: "task",
            entityId: taskId,
            entityLabel: task.title,
            projectId: task.projectId,
            actorId: authorId,
            createdAt: now,
          });
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                comments: [
                  ...task.comments,
                  { id: uid("c"), authorId, body: body.trim(), createdAt: now },
                ],
                updatedAt: now,
              },
            },
            activity: { ...state.activity, [entry.id]: entry },
          };
        }),

      addAttachment: (taskId, input) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                attachments: [
                  ...task.attachments,
                  { ...input, id: uid("a"), uploadedAt: new Date().toISOString() },
                ],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      deleteAttachment: (taskId, attachmentId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                attachments: task.attachments.filter(
                  (a) => a.id !== attachmentId,
                ),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      createEvent: (input) => {
        const state = get();
        const event: CalendarEvent = {
          id: uid("e"),
          workspaceId: state.activeWorkspaceId,
          ...input,
          createdAt: new Date().toISOString(),
        };
        const entry = logActivity(state, {
          kind: "event.created",
          entityType: "event",
          entityId: event.id,
          entityLabel: event.title,
          projectId: event.projectId,
        });
        set((current) => ({
          events: { ...current.events, [event.id]: event },
          activity: { ...current.activity, [entry.id]: entry },
        }));
        return event;
      },

      updateEvent: (id, patch) =>
        set((state) => {
          const event = state.events[id];
          if (!event) return state;
          return { events: { ...state.events, [id]: { ...event, ...patch } } };
        }),

      deleteEvent: (id) =>
        set((state) => {
          if (!state.events[id]) return state;
          const events = { ...state.events };
          delete events[id];
          return { events };
        }),

      sendMessage: (conversationId, authorId, body) =>
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation || !body.trim()) return state;
          const now = new Date().toISOString();
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conversation,
                messages: [
                  ...conversation.messages,
                  { id: uid("m"), authorId, body: body.trim(), createdAt: now },
                ],
                lastReadAt: now,
              },
            },
          };
        }),

      markConversationRead: (conversationId) =>
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: { ...conversation, lastReadAt: new Date().toISOString() },
            },
          };
        }),

      createConversation: (input) => {
        const state = get();
        const now = new Date().toISOString();
        const conversation: Conversation = {
          id: uid("c"),
          workspaceId: state.activeWorkspaceId,
          kind: input.kind,
          name: input.name,
          participantIds: Array.from(new Set([state.currentUserId, ...input.participantIds])),
          projectId: input.projectId,
          messages: input.firstMessage?.trim()
            ? [
                {
                  id: uid("m"),
                  authorId: state.currentUserId,
                  body: input.firstMessage.trim(),
                  createdAt: now,
                },
              ]
            : [],
          lastReadAt: now,
        };
        set((current) => ({
          conversations: { ...current.conversations, [conversation.id]: conversation },
        }));
        return conversation;
      },

      markNotificationRead: (id) =>
        set((state) => {
          const notification = state.notifications[id];
          if (!notification) return state;
          return {
            notifications: {
              ...state.notifications,
              [id]: { ...notification, read: true },
            },
          };
        }),

      markAllNotificationsRead: (workspaceId) =>
        set((state) => {
          const notifications = { ...state.notifications };
          for (const notification of Object.values(notifications)) {
            if (notification.workspaceId === workspaceId) {
              notifications[notification.id] = { ...notification, read: true };
            }
          }
          return { notifications };
        }),
    }),
    {
      name: "nexus:data:v1",
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        version: state.version,
        workspaces: state.workspaces,
        members: state.members,
        projects: state.projects,
        tasks: state.tasks,
        events: state.events,
        conversations: state.conversations,
        notifications: state.notifications,
        activity: state.activity,
        activeWorkspaceId: state.activeWorkspaceId,
        currentUserId: state.currentUserId,
        preferences: state.preferences,
      }),
      merge: (persisted, current) => {
        const candidate = persisted as Partial<PersistedState> | undefined;

        if (
          !candidate ||
          candidate.version !== DATA_VERSION ||
          !candidate.workspaces ||
          !candidate.projects ||
          !candidate.tasks
        ) {
          return { ...current, hydrated: false };
        }

        const activeWorkspaceId =
          candidate.activeWorkspaceId && candidate.workspaces[candidate.activeWorkspaceId]
            ? candidate.activeWorkspaceId
            : current.activeWorkspaceId;

        return {
          ...current,
          ...candidate,
          activeWorkspaceId,
          hydrated: false,
        };
      },
    },
  ),
);
