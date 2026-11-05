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
import { toast } from "sonner";
import { isBackendEnabled } from "./api";
import {
  liveAddAttachment,
  liveAddComment,
  liveAddSubtask,
  liveCreateEvent,
  liveCreateProject,
  liveCreateTask,
  liveDeleteAttachment,
  liveDeleteEvent,
  liveDeleteProject,
  liveDeleteSubtask,
  liveDeleteTask,
  liveListActivity,
  liveListEvents,
  liveListMembers,
  liveListProjects,
  liveListTasks,
  liveMoveTask,
  liveUpdateEvent,
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
  events: Record<string, any>;
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
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addComment: (taskId: string, authorId: string, body: string) => Promise<void>;
  addAttachment: (taskId: string, input: Omit<Attachment, "id" | "uploadedAt">) => Promise<void>;
  deleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  createEvent: (input: any) => Promise<any>;
  listEvents: (workspaceId: string) => Promise<void>;
  updateEvent: (id: string, patch: any) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useLiveWorkStore = create<LiveState>((set, get) => ({
  status: "idle",
  error: null,
  activeWorkspaceId: null,
  currentUserId: null,
  projects: {},
  tasks: {},
  members: {},
  events: {},
  workspaces: {},
  activity: {},

  bootstrap: async (workspaceId: string) => {
    set({ status: "loading", error: null });
    try {
      const [projects, members, events] = await Promise.all([
        liveListProjects(workspaceId),
        liveListMembers(workspaceId),
        liveListEvents(workspaceId),
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
      const eventMap: Record<string, any> = {};
      for (const event of events) {
        eventMap[event.id] = event;
      }

      set({
        status: "ready",
        activeWorkspaceId: workspaceId,
        projects: projectMap,
        members: memberMap,
        events: eventMap,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workspace.";
      set({ status: "error", error: message });
      toast.error(message);
    }
  },

  createProject: async (input) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected.");

    const optimisticProject: any = {
      id: `optimistic-${Date.now()}`,
      workspaceId,
      name: input.name,
      key: input.name.slice(0, 3).toUpperCase(),
      description: input.description,
      status: input.status,
      priority: input.priority,
      colorHue: 264,
      startDate: new Date().toISOString(),
      dueDate: input.dueDate,
      memberIds: input.memberIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      projects: { ...state.projects, [optimisticProject.id]: optimisticProject },
    }));

    try {
      const project = await liveCreateProject(workspaceId, input);
      set((state) => {
        const { [optimisticProject.id]: _removed, ...rest } = state.projects;
        return { projects: { ...rest, [project.id]: project } };
      });
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project.";
      set((state) => {
        const { [optimisticProject.id]: _removed, ...rest } = state.projects;
        return { projects: rest };
      });
      toast.error(message);
      throw error;
    }
  },

  updateProject: async (id, patch) => {
    const project = get().projects[id];
    if (!project) throw new Error("Project not found.");
    const previous = { ...project };
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : undefined;

    // Optimistic update
    const optimisticProject = { ...project };
    if (patch.name !== undefined) optimisticProject.name = patch.name;
    if (patch.description !== undefined) optimisticProject.description = patch.description;
    if (patch.status !== undefined) optimisticProject.status = patch.status;
    if (patch.priority !== undefined) optimisticProject.priority = patch.priority;
    if (patch.dueDate !== undefined) optimisticProject.dueDate = patch.dueDate;
    if (patch.memberIds !== undefined) optimisticProject.memberIds = patch.memberIds;
    if (patch.colorHue !== undefined) optimisticProject.colorHue = patch.colorHue;

    set((state) => ({
      projects: { ...state.projects, [id]: optimisticProject },
    }));

    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update project.";
      set((state) => ({
        projects: { ...state.projects, [id]: previous },
      }));
      toast.error(message);
      throw error;
    }
  },

  deleteProject: async (id) => {
    const project = get().projects[id];
    if (!project) throw new Error("Project not found.");

    set((state) => {
      const { [id]: _removed, ...rest } = state.projects;
      return { projects: rest };
    });

    try {
      await liveDeleteProject(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete project.";
      set((state) => ({
        projects: { ...state.projects, [id]: project },
      }));
      toast.error(message);
      throw error;
    }
  },

  createTask: async (input) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected.");

    // Optimistic: create a local task entry immediately
    const optimisticTask: any = {
      id: `optimistic-${Date.now()}`,
      workspaceId,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ?? null,
      reporterId: get().currentUserId ?? "",
      dueDate: input.dueDate,
      labels: input.labels ?? [],
      order: 0,
      subtasks: [],
      comments: [],
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    set((state) => ({
      tasks: { ...state.tasks, [optimisticTask.id]: optimisticTask },
    }));

    try {
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
      // Replace optimistic entry with server response
      set((state) => {
        const { [optimisticTask.id]: _removed, ...rest } = state.tasks;
        return { tasks: { ...rest, [task.id]: task } };
      });
      return task;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create task.";
      // Rollback: remove optimistic entry
      set((state) => {
        const { [optimisticTask.id]: _removed, ...rest } = state.tasks;
        return { tasks: rest };
      });
      toast.error(message);
      throw error;
    }
  },

  updateTask: async (id, patch) => {
    const task = get().tasks[id];
    if (!task) throw new Error("Task not found.");
    const previous = { ...task };
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : undefined;

    // Optimistic update
    const optimisticTask = { ...task };
    if (patch.title !== undefined) optimisticTask.title = patch.title;
    if (patch.description !== undefined) optimisticTask.description = patch.description;
    if (patch.status !== undefined) optimisticTask.status = patch.status;
    if (patch.priority !== undefined) optimisticTask.priority = patch.priority;
    if (patch.assigneeId !== undefined) optimisticTask.assigneeId = patch.assigneeId;
    if (patch.dueDate !== undefined) optimisticTask.dueDate = patch.dueDate;
    if (patch.labels !== undefined) optimisticTask.labels = patch.labels;
    if (patch.projectId !== undefined) optimisticTask.projectId = patch.projectId;

    set((state) => ({
      tasks: { ...state.tasks, [id]: optimisticTask },
    }));

    try {
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
      // Replace optimistic with server response
      set((state) => ({
        tasks: { ...state.tasks, [id]: updated },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update task.";
      // Rollback
      set((state) => ({
        tasks: { ...state.tasks, [id]: previous },
      }));
      toast.error(message);
      throw error;
    }
  },

  moveTask: async (id, status, index = 0) => {
    const task = get().tasks[id];
    if (!task) throw new Error("Task not found.");
    const previous = { ...task };

    // Optimistic update
    set((state) => ({
      tasks: { ...state.tasks, [id]: { ...task, status, order: index + 1 } },
    }));

    try {
      await liveMoveTask(id, { status, index });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to move task.";
      // Rollback
      set((state) => ({
        tasks: { ...state.tasks, [id]: previous },
      }));
      toast.error(message);
      throw error;
    }
  },

  deleteTask: async (id) => {
    const task = get().tasks[id];
    if (!task) throw new Error("Task not found.");

    // Optimistic removal
    set((state) => {
      const { [id]: _removed, ...rest } = state.tasks;
      return { tasks: rest };
    });

    try {
      await liveDeleteTask(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete task.";
      // Rollback
      set((state) => ({
        tasks: { ...state.tasks, [id]: task },
      }));
      toast.error(message);
      throw error;
    }
  },

  addSubtask: async (taskId, title) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected.");

    // Optimistic: create a local subtask entry immediately
    const optimisticSubtask: Subtask = {
      id: `optimistic-${Date.now()}`,
      title,
      done: false,
    };
    const task = get().tasks[taskId];
    if (task) {
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskId]: { ...task, subtasks: [...task.subtasks, optimisticSubtask] },
        },
      }));
    }

    try {
      const subtask = await liveAddSubtask({ taskId, title });
      // Replace optimistic entry with server response
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...t,
              subtasks: t.subtasks.map((s: any) =>
                s.id === optimisticSubtask.id ? subtask : s,
              ),
            },
          },
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add subtask.";
      // Rollback: remove optimistic entry
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...t,
              subtasks: t.subtasks.filter((s: any) => s.id !== optimisticSubtask.id),
            },
          },
        };
      });
      toast.error(message);
      throw error;
    }
  },

  toggleSubtask: async (taskId, subtaskId) => {
    const task = get().tasks[taskId];
    if (!task) throw new Error("Task not found.");
    const subtask = task.subtasks.find((s: any) => s.id === subtaskId);
    if (!subtask) throw new Error("Subtask not found.");
    const previousDone = subtask.done;

    // Optimistic update
    set((state) => {
      const t = state.tasks[taskId];
      if (!t) return state;
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...t,
            subtasks: t.subtasks.map((s: any) =>
              s.id === subtaskId ? { ...s, done: !s.done } : s,
            ),
          },
        },
      };
    });

    try {
      await liveUpdateSubtask({ taskId, subtaskId, data: { done: !previousDone } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update subtask.";
      // Rollback on failure
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...t,
              subtasks: t.subtasks.map((s: any) =>
                s.id === subtaskId ? { ...s, done: previousDone } : s,
              ),
            },
          },
        };
      });
      toast.error(message);
      throw error;
    }
  },

  deleteSubtask: async (taskId: string, subtaskId: string) => {
    const task = get().tasks[taskId];
    if (!task) throw new Error("Task not found.");
    const subtask = task.subtasks.find((s: any) => s.id === subtaskId);
    if (!subtask) throw new Error("Subtask not found.");
    const previousSubtasks = task.subtasks;

    // Optimistic removal
    set((state) => {
      const t = state.tasks[taskId];
      if (!t) return state;
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...t,
            subtasks: t.subtasks.filter((s: any) => s.id !== subtaskId),
          },
        },
      };
    });

    try {
      await liveDeleteSubtask(taskId, subtaskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete subtask.";
      // Rollback
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...t,
              subtasks: previousSubtasks,
            },
          },
        };
      });
      toast.error(message);
      throw error;
    }
  },

  addComment: async (taskId, authorId, body) => {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add comment.";
      toast.error(message);
      throw error;
    }
  },

  addAttachment: async (taskId, input) => {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add attachment.";
      toast.error(message);
      throw error;
    }
  },

  deleteAttachment: async (taskId, attachmentId) => {
    const task = get().tasks[taskId];
    if (!task) throw new Error("Task not found.");
    const previousAttachments = task.attachments;

    // Optimistic removal
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

    try {
      await liveDeleteAttachment(taskId, attachmentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete attachment.";
      // Rollback
      set((state) => {
        const t = state.tasks[taskId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...t,
              attachments: previousAttachments,
            },
          },
        };
      });
      toast.error(message);
      throw error;
    }
  },

  createEvent: async (input) => {
    try {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) throw new Error("No workspace selected.");
      return liveCreateEvent(workspaceId, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create event.";
      toast.error(message);
      throw error;
    }
  },
  listEvents: async (workspaceId) => {
    try {
      const events = await liveListEvents(workspaceId);
      const eventMap: Record<string, any> = {};
      for (const event of events) {
        eventMap[event.id] = event;
      }
      set((state) => ({
        events: { ...state.events, ...eventMap },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load events.";
      toast.error(message);
      throw error;
    }
  },
  updateEvent: async (id, patch) => {
    try {
      const updated = await liveUpdateEvent(id, patch);
      set((state) => ({
        events: { ...state.events, [id]: updated },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update event.";
      toast.error(message);
      throw error;
    }
  },
  deleteEvent: async (id) => {
    try {
      await liveDeleteEvent(id);
      set((state) => {
        const { [id]: _removed, ...rest } = state.events;
        return { events: rest };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete event.";
      toast.error(message);
      throw error;
    }
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
