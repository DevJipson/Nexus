/**
 * Live-mode facade store for projects and tasks.
 *
 * Mirrors the action signatures of `useWorkspaceStore` so screens can branch
 * on live vs. local with a minimal diff. State is kept in memory and synced
 * with the server; reads are synchronous, mutations return Promises.
 *
 * When `NEXT_PUBLIC_NEXUS_API_URL` is unset, `useLiveWork()` returns `null` and
 * screens fall back to `useWorkspaceStore()` unchanged (local demo mode).
 *
 * This module intentionally uses `any` for cached server data — it is an
 * adapter layer between the typed domain model and the untyped API responses.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { isBackendEnabled } from "./api";
import {
  liveAddAttachment,
  liveAddComment,
  liveAddSubtask,
  liveCreateEvent,
  liveCreateProject,
  liveCreateTask,
  liveDeleteAttachment,
  liveDeleteProject,
  liveDeleteTask,
  liveListActivity,
  liveListProjects,
  liveListTasks,
  liveListMembers,
  liveMoveTask,
  liveUpdateProject,
  liveUpdateSubtask,
  liveUpdateTask,
} from "./live-work";
import type {
  Attachment,
  Comment,
  Member,
  ProjectStatus,
  Subtask,
  Task,
  TaskLabel,
} from "@/types/domain";
import type { CreateProjectInput, CreateTaskInput } from "@/store/workspace-store";

export interface LiveMember {
  id: string;
  name: string;
  avatarHue: number;
  presence: Member["presence"];
}

export interface LiveState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  activeWorkspaceId: string | null;
  currentUserId: string | null;
  projects: Record<string, any>;
  tasks: Record<string, any>;
  members: Record<string, LiveMember>;
  workspaces: Record<string, { id: string; name: string; role: string }>;
  activity: Record<string, { entries: any[]; fetchedAt: number }>;

  bootstrap: (workspaceId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<any>;
  updateProject: (
    id: string,
    patch: Partial<Pick<any, "name" | "description" | "status" | "priority" | "dueDate" | "memberIds" | "colorHue">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<any>;
  updateTask: (
    id: string,
    patch: Partial<Pick<any, "title" | "description" | "status" | "priority" | "assigneeId" | "dueDate" | "labels" | "projectId">>,
  ) => Promise<void>;
  moveTask: (id: string, status: any, index?: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addComment: (taskId: string, authorId: string, body: string) => Promise<void>;
  addAttachment: (taskId: string, input: Omit<Attachment, "id" | "uploadedAt">) => Promise<void>;
  deleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  createEvent: (input: any) => Promise<any>;
}

export const useLiveWorkStore = create<LiveState>((set, get) => ({
  status: "idle",
  error: null,
  activeWorkspaceId: null,
  currentUserId: null,
  projects: {},
  tasks: {},
  members: {},
  workspaces: {},
  activity: {},

  bootstrap: async (workspaceId: string) => {
    set({ status: "loading", error: null });
    try {
      const [projects, members] = await Promise.all([
        liveListProjects(workspaceId),
        liveListMembers(workspaceId),
      ]);
      const projectMap: Record<string, any> = {};
      for (const row of projects) {
        projectMap[row.project.id] = row.project;
      }
      const memberMap: Record<string, LiveMember> = {};
      for (const member of members) {
        memberMap[member.id] = {
          id: member.id,
          name: member.name,
          avatarHue: member.avatarHue,
          presence: member.presence ?? "offline",
        };
      }

      set({
        status: "ready",
        activeWorkspaceId: workspaceId,
        projects: { ...get().projects, ...projectMap },
        members: { ...get().members, ...memberMap },
      });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : "Failed to load workspace." });
    }
  },

  createProject: async (input) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected.");
    const project = await liveCreateProject(workspaceId, input);
    set((state) => ({
      projects: { ...state.projects, [project.id]: project },
    }));
    return project;
  },

  updateProject: async (id, patch) => {
    const project = get().projects[id];
    if (!project) throw new Error("Project not found.");
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : undefined;
    const updated = await liveUpdateProject(id, {
      name: patch.name,
      description: patch.description,
      status: patch.status as ProjectStatus | undefined,
      priority: patch.priority,
      dueDate,
      memberIds: patch.memberIds,
      colorHue: patch.colorHue,
    });
    set((state) => ({
      projects: { ...state.projects, [id]: updated },
    }));
  },

  deleteProject: async (id) => {
    await liveDeleteProject(id);
    set((state) => {
      const { [id]: _removed, ...rest } = state.projects;
      return { projects: rest };
    });
  },

  createTask: async (input) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected.");
    const task = await liveCreateTask(workspaceId, {
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate,
      labels: input.labels,
    });
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    }));
    return task;
  },

  updateTask: async (id, patch) => {
    const task = get().tasks[id];
    if (!task) throw new Error("Task not found.");
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : undefined;
    const updated = await liveUpdateTask(id, {
      title: patch.title,
      description: patch.description,
      status: patch.status,
      priority: patch.priority,
      assigneeId: patch.assigneeId,
      dueDate,
      labels: patch.labels as TaskLabel[] | undefined,
      projectId: patch.projectId,
    });
    set((state) => ({
      tasks: { ...state.tasks, [id]: updated },
    }));
  },

  moveTask: async (id, status, index = 0) => {
    await liveMoveTask(id, { status, index });
    const task = get().tasks[id];
    if (task) {
      set((state) => ({
        tasks: { ...state.tasks, [id]: { ...task, status, order: index + 1 } },
      }));
    }
  },

  deleteTask: async (id) => {
    await liveDeleteTask(id);
    set((state) => {
      const { [id]: _removed, ...rest } = state.tasks;
      return { tasks: rest };
    });
  },

  addSubtask: async (taskId, title) => {
    const subtask = await liveAddSubtask({ taskId, title });
    const task = get().tasks[taskId];
    if (task) {
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskId]: { ...task, subtasks: [...task.subtasks, subtask] },
        },
      }));
    }
  },

  toggleSubtask: async (taskId, subtaskId) => {
    const task = get().tasks[taskId];
    if (!task) throw new Error("Task not found.");
    const subtask = task.subtasks.find((s: any) => s.id === subtaskId);
    if (!subtask) throw new Error("Subtask not found.");
    await liveUpdateSubtask({ taskId, subtaskId, data: { done: !subtask.done } });
    set((state) => {
      const t = state.tasks[taskId];
      if (!t) return state;
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...t,
            subtasks: t.subtasks.map((s: any) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
          },
        },
      };
    });
  },

  addComment: async (taskId, authorId, body) => {
    const comment = await liveAddComment({ taskId, authorId, body });
    const task = get().tasks[taskId];
    if (task) {
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: { ...t, comments: [...t.comments, comment] },
          },
        };
      });
    }
  },

  addAttachment: async (taskId, input) => {
    const currentUserId = get().currentUserId;
    const attachment = await liveAddAttachment({
      taskId,
      uploaderId: currentUserId ?? "",
      name: input.name,
      size: input.size,
      mimeType: input.mimeType,
    });
    const task = get().tasks[taskId];
    if (task) {
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: { ...t, attachments: [...t.attachments, attachment] },
          },
        };
      });
    }
  },

  deleteAttachment: async (taskId, attachmentId) => {
    await liveDeleteAttachment(taskId, attachmentId);
    const task = get().tasks[taskId];
    if (task) {
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...t,
              attachments: t.attachments.filter((a: any) => a.id !== attachmentId),
            },
          },
        };
      });
    }
  },

  createEvent: async (input) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected.");
    return liveCreateEvent(workspaceId, input);
  },
}));

/**
 * Hook: returns the live data source when the backend is configured, else null.
 * Screens use `ds ?? state` to branch between live and local demo modes.
 */
export function useLiveWork(): LiveState | null {
  // Hooks must run in the same order every render: call the store hook first,
  // then gate on backend configuration.
  const store = useLiveWorkStore((state) => state);
  if (typeof window === "undefined" || !isBackendEnabled) return null;
  return store;
}
