/**
 * Unified data source for projects and tasks.
 *
 * When the backend is configured (`NEXT_PUBLIC_NEXUS_API_URL`), returns the
 * live facade store (async, server-synced). Otherwise returns the local
 * `useWorkspaceStore()` actions unchanged, so screens keep working in demo
 * mode with zero behaviour change.
 *
 * Screens replace `const state = useWorkspaceStore()` with `const ds =
 * useDataSource()` and read/mutate through `ds`. For reads that the local
 * store selectors provide (`workspaceProjects`, `workspaceMembers`, ...), `ds`
 * exposes equivalent synchronous getters. For mutations, `ds` exposes the same
 * action names (async in live mode, sync in local mode).
 *
 * This module intentionally uses `any` for cached server data — it is an
 * adapter layer between the typed domain model and the untyped API responses.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  workspaceMembers,
  workspaceProjects,
  workspaceTasks,
  projectTasks,
  sortProjects,
  projectStats,
  taskStats,
  filterTasks,
  groupTasksByStatus,
  rankTasks,
  sortTasksForBoard,
  isTaskOverdue,
  isTaskDueToday,
} from "@/lib/selectors";
import { liveListActivity } from "./live-work";
import type { TaskFilters, TaskStatus } from "@/types/domain";
import { useLiveWork, type LiveState } from "./live-work-store";

export interface DataSource {
  mode: "live" | "local";
  // Context
  activeWorkspaceId: string | null;
  currentUserId: string | null;
  // Entity caches (synchronous reads)
  projects: Record<string, any>;
  tasks: Record<string, any>;
  members: Record<string, any>;
  workspaces: Record<string, any>;
  // Bootstrap / workspace switching
  bootstrap: (workspaceId: string) => Promise<void>;
  // Project actions
  createProject: (input: any) => Promise<any>;
  updateProject: (id: string, patch: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  // Task actions
  createTask: (input: any) => Promise<any>;
  updateTask: (id: string, patch: any) => Promise<void>;
  moveTask: (id: string, status: TaskStatus, index?: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addComment: (taskId: string, authorId: string, body: string) => Promise<void>;
  addAttachment: (taskId: string, input: any) => Promise<void>;
  createEvent: (input: any) => Promise<any>;
  // Activity
  listActivity: (workspaceId: string, filters?: any) => Promise<any[]>;
  // Selector-compatible getters (take ids, return arrays)
  workspaceProjects: (workspaceId: string) => any[];
  workspaceMembers: (workspaceId: string) => any[];
  workspaceTasks: (workspaceId: string) => any[];
  projectTasks: (projectId: string) => any[];
}

export function useDataSource(): DataSource {
  const ds = useLiveWork();
  const state = useWorkspaceStore();

  if (ds) {
    return {
      mode: "live",
      activeWorkspaceId: ds.activeWorkspaceId,
      currentUserId: ds.currentUserId,
      projects: ds.projects,
      tasks: ds.tasks,
      members: ds.members,
      workspaces: ds.workspaces,
      bootstrap: ds.bootstrap,
      createProject: (input: any) => ds.createProject(input),
      updateProject: (id: string, patch: any) => ds.updateProject(id, patch),
      deleteProject: (id: string) => ds.deleteProject(id),
      createTask: (input: any) => ds.createTask(input),
      updateTask: (id: string, patch: any) => ds.updateTask(id, patch),
      moveTask: (id: string, status: TaskStatus, index?: number) =>
        ds.moveTask(id, status, index),
      deleteTask: (id: string) => ds.deleteTask(id),
      addSubtask: (taskId: string, title: string) => ds.addSubtask(taskId, title),
      toggleSubtask: (taskId: string, subtaskId: string) =>
        ds.toggleSubtask(taskId, subtaskId),
      addComment: (taskId: string, authorId: string, body: string) =>
        ds.addComment(taskId, authorId, body),
      addAttachment: (taskId: string, input: any) =>
        ds.addAttachment(taskId, input),
      createEvent: (input: any) => ds.createEvent(input),
      listActivity: (workspaceId: string, filters?: any) =>
        liveListActivity(workspaceId, filters),
      workspaceProjects: (workspaceId) =>
        Object.values(ds.projects).filter((p: any) => p.workspaceId === workspaceId),
      workspaceMembers: (workspaceId) => Object.values(ds.members),
      workspaceTasks: (workspaceId) =>
        Object.values(ds.tasks).filter((t: any) => t.workspaceId === workspaceId),
      projectTasks: (projectId) =>
        Object.values(ds.tasks).filter((t: any) => t.projectId === projectId),
    };
  }

  return {
    mode: "local",
    activeWorkspaceId: state.activeWorkspaceId,
    currentUserId: state.currentUserId,
    projects: state.projects,
    tasks: state.tasks,
    members: state.members,
    workspaces: state.workspaces,
    bootstrap: async () => undefined,
    createProject: async (input: any) => state.createProject(input),
    updateProject: async (id: string, patch: any) => state.updateProject(id, patch),
    deleteProject: async (id: string) => state.deleteProject(id),
    createTask: async (input: any) => state.createTask(input),
    updateTask: async (id: string, patch: any) => state.updateTask(id, patch),
    moveTask: async (id: string, status: TaskStatus, index?: number) =>
      state.moveTask(id, status, index),
    deleteTask: async (id: string) => state.deleteTask(id),
    addSubtask: async (taskId: string, title: string) => state.addSubtask(taskId, title),
    toggleSubtask: async (taskId: string, subtaskId: string) =>
      state.toggleSubtask(taskId, subtaskId),
    addComment: async (taskId: string, authorId: string, body: string) =>
      state.addComment(taskId, authorId, body),
    addAttachment: async (taskId: string, input: any) =>
      state.addAttachment(taskId, input),
    createEvent: async (input: any) => state.createEvent(input),
    listActivity: async () => [],
    workspaceProjects: (workspaceId: string) =>
      workspaceProjects(state as any, workspaceId),
    workspaceMembers: (workspaceId: string) =>
      workspaceMembers(state as any, workspaceId),
    workspaceTasks: (workspaceId: string) =>
      workspaceTasks(state as any, workspaceId),
    projectTasks: (projectId: string) => projectTasks(state as any, projectId),
  };
}

/* ---------------------------------------------------------------- selector shims */

export function useDataSourceSelectors() {
  const state = useWorkspaceStore();
  const ds = useLiveWork();

  return {
    sortProjects: (filtered: any[], sort: "updated" | "due" | "name" | "progress") =>
      ds
        ? [...filtered].sort((a: any, b: any) => {
            const aTime = new Date(a.updatedAt).getTime();
            const bTime = new Date(b.updatedAt).getTime();
            return bTime - aTime;
          })
        : sortProjects(state as any, filtered, sort),
    projectStats: (project: any, now: Date) => {
      const tasks = ds
        ? Object.values(ds.tasks).filter((t: any) => t.projectId === project.id)
        : projectTasks(state as any, project.id);
      return taskStats(tasks, now);
    },
    taskStats: (tasks: any[], now: Date) => taskStats(tasks, now),
    filterTasks: (tasks: any[], filters: TaskFilters) => filterTasks(tasks, filters),
    groupTasksByStatus: (tasks: any[]) => groupTasksByStatus(tasks),
    rankTasks: (tasks: any[], now: Date) => rankTasks(tasks, now),
    sortTasksForBoard: (tasks: any[]) => sortTasksForBoard(tasks),
    isTaskOverdue: (task: any, now: Date) => isTaskOverdue(task, now),
    isTaskDueToday: (task: any, now: Date) => isTaskDueToday(task, now),
  };
}
