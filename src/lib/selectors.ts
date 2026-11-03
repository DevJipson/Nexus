import {
  differenceInCalendarDays,
  eachWeekOfInterval,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import type {
  ActivityEntry,
  CalendarEvent,
  Conversation,
  ID,
  Member,
  Notification,
  PersistedState,
  Priority,
  Project,
  Task,
  TaskFilters,
  TaskStatus,
  Workspace,
} from "@/types/domain";
import { PRIORITY_META, TASK_STATUS_ORDER } from "@/lib/domain-meta";

/**
 * Selectors are pure and live outside React so they can be unit tested and
 * reused by charts, board columns and the command palette without drift.
 */

const WEEK_OPTS = { weekStartsOn: 1 as const };

export function getWorkspace(state: PersistedState, workspaceId: ID): Workspace | null {
  return state.workspaces[workspaceId] ?? null;
}

export function getMember(state: PersistedState, memberId: ID | null): Member | null {
  if (!memberId) return null;
  return state.members[memberId] ?? null;
}

export function getProject(state: PersistedState, projectId: ID): Project | null {
  return state.projects[projectId] ?? null;
}

export function getTask(state: PersistedState, taskId: ID): Task | null {
  return state.tasks[taskId] ?? null;
}

export function workspaceMembers(state: PersistedState, workspaceId: ID): Member[] {
  const workspace = getWorkspace(state, workspaceId);
  if (!workspace) return [];
  return workspace.memberIds
    .map((id) => state.members[id])
    .filter((member): member is Member => Boolean(member));
}

export function workspaceProjects(state: PersistedState, workspaceId: ID): Project[] {
  return Object.values(state.projects)
    .filter((project) => project.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function workspaceTasks(state: PersistedState, workspaceId: ID): Task[] {
  return Object.values(state.tasks).filter((task) => task.workspaceId === workspaceId);
}

export function projectTasks(state: PersistedState, projectId: ID): Task[] {
  return Object.values(state.tasks).filter((task) => task.projectId === projectId);
}

export function workspaceEvents(state: PersistedState, workspaceId: ID): CalendarEvent[] {
  return Object.values(state.events)
    .filter((event) => event.workspaceId === workspaceId)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function lastMessage(conversation: Conversation) {
  return conversation.messages[conversation.messages.length - 1] ?? null;
}

export function workspaceConversations(
  state: PersistedState,
  workspaceId: ID,
): Conversation[] {
  return Object.values(state.conversations)
    .filter((conversation) => conversation.workspaceId === workspaceId)
    .sort((a, b) => {
      const aTime = lastMessage(a)?.createdAt ?? "";
      const bTime = lastMessage(b)?.createdAt ?? "";
      return bTime.localeCompare(aTime);
    });
}

export function workspaceNotifications(
  state: PersistedState,
  workspaceId: ID,
): Notification[] {
  return Object.values(state.notifications)
    .filter((notification) => notification.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function workspaceActivity(state: PersistedState, workspaceId: ID): ActivityEntry[] {
  return Object.values(state.activity)
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadNotifications(state: PersistedState, workspaceId: ID): number {
  return workspaceNotifications(state, workspaceId).filter((item) => !item.read).length;
}

export function unreadConversations(
  state: PersistedState,
  workspaceId: ID,
  currentUserId: ID,
): number {
  return workspaceConversations(state, workspaceId).filter((conversation) =>
    conversation.messages.some(
      (message) =>
        message.authorId !== currentUserId &&
        message.createdAt.localeCompare(conversation.lastReadAt) > 0,
    ),
  ).length;
}

export function conversationTitle(
  conversation: Conversation,
  state: PersistedState,
  currentUserId: ID,
): string {
  if (conversation.name) return conversation.name;
  const others = conversation.participantIds
    .filter((id) => id !== currentUserId)
    .map((id) => state.members[id]?.name)
    .filter((name): name is string => Boolean(name));
  return others.length ? others.join(", ") : "Just you";
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return parseISO(task.dueDate) < now;
}

export function isTaskDueToday(task: Task, now = new Date()): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return isSameDay(parseISO(task.dueDate), now);
}

export function isTaskDueWithin(task: Task, days: number, now = new Date()): boolean {
  if (!task.dueDate || task.status === "done") return false;
  const due = parseISO(task.dueDate);
  return due >= startOfDay(now) && due.getTime() <= startOfDay(now).getTime() + days * 86_400_000;
}

export function sortTasksForBoard(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return TASK_STATUS_ORDER.indexOf(a.status) - TASK_STATUS_ORDER.indexOf(b.status);
    }
    return a.order - b.order;
  });
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const needle = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.assigneeId !== "all") {
      if (filters.assigneeId === "unassigned") {
        if (task.assigneeId !== null) return false;
      } else if (task.assigneeId !== filters.assigneeId) {
        return false;
      }
    }
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.projectId !== "all" && task.projectId !== filters.projectId) return false;
    if (filters.label !== "all" && !task.labels.includes(filters.label)) return false;
    if (!needle) return true;
    return [task.title, task.description, task.labels.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
  };
  for (const task of tasks) {
    groups[task.status].push(task);
  }
  for (const status of TASK_STATUS_ORDER) {
    groups[status].sort((a, b) => a.order - b.order);
  }
  return groups;
}

export function taskPriorityScore(task: Task): number {
  return PRIORITY_META[task.priority].rank;
}

/** "What should I look at next?" — overdue first, then priority, then due date. */
export function rankTasks(tasks: Task[], now = new Date()): Task[] {
  return [...tasks]
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const aOverdue = isTaskOverdue(a, now) ? 1 : 0;
      const bOverdue = isTaskOverdue(b, now) ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      const priority = taskPriorityScore(b) - taskPriorityScore(a);
      if (priority !== 0) return priority;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

export interface TaskStats {
  total: number;
  done: number;
  open: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completionRate: number;
}

export function taskStats(tasks: Task[], now = new Date()): TaskStats {
  const done = tasks.filter((task) => task.status === "done").length;
  const total = tasks.length;
  return {
    total,
    done,
    open: total - done,
    inProgress: tasks.filter(
      (task) => task.status === "in_progress" || task.status === "in_review",
    ).length,
    overdue: tasks.filter((task) => isTaskOverdue(task, now)).length,
    dueToday: tasks.filter((task) => isTaskDueToday(task, now)).length,
    dueThisWeek: tasks.filter((task) => isTaskDueWithin(task, 7, now)).length,
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function projectStats(
  state: PersistedState,
  projectId: ID,
  now = new Date(),
): TaskStats {
  return taskStats(projectTasks(state, projectId), now);
}

export function nextDueTask(state: PersistedState, projectId: ID): Task | null {
  const candidates = projectTasks(state, projectId)
    .filter((task) => task.dueDate && task.status !== "done")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  return candidates[0] ?? null;
}

export function sortProjects(
  state: PersistedState,
  projects: Project[],
  sort: "updated" | "due" | "name" | "progress",
): Project[] {
  const copy = [...projects];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "due":
      return copy.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    case "progress":
      return copy.sort(
        (a, b) =>
          projectStats(state, b.id).completionRate - projectStats(state, a.id).completionRate,
      );
    default:
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

/* -------------------------------------------------------------------------- */
/* Dashboard & reports                                                        */
/* -------------------------------------------------------------------------- */

export interface Overview {
  projects: Project[];
  activeProjects: Project[];
  tasks: Task[];
  stats: TaskStats;
  members: Member[];
  onlineMembers: number;
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
  activity: ActivityEntry[];
  conversations: number;
  unreadMessages: number;
  unreadNotifications: number;
}

export function workspaceOverview(
  state: PersistedState,
  workspaceId: ID,
  now = new Date(),
): Overview {
  const projects = workspaceProjects(state, workspaceId);
  const tasks = workspaceTasks(state, workspaceId);
  const members = workspaceMembers(state, workspaceId);
  const events = workspaceEvents(state, workspaceId);

  return {
    projects,
    activeProjects: projects.filter((project) => project.status === "active"),
    tasks,
    stats: taskStats(tasks, now),
    members,
    onlineMembers: members.filter((member) => member.presence === "online").length,
    events,
    upcoming: events.filter((event) => parseISO(event.end) >= startOfDay(now)).slice(0, 5),
    activity: workspaceActivity(state, workspaceId).slice(0, 6),
    conversations: workspaceConversations(state, workspaceId).length,
    unreadMessages: unreadConversations(state, workspaceId, state.currentUserId),
    unreadNotifications: unreadNotifications(state, workspaceId),
  };
}

export interface CompletionPoint {
  week: string;
  label: string;
  completed: number;
  created: number;
}

export function completionSeries(tasks: Task[], weeks = 8, now = new Date()): CompletionPoint[] {
  const buckets = eachWeekOfInterval(
    { start: subWeeks(startOfWeek(now, WEEK_OPTS), weeks - 1), end: now },
    WEEK_OPTS,
  );

  return buckets.map((weekStart) => {
    const start = weekStart.getTime();
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const endTime = end.getTime();

    return {
      week: format(weekStart, "yyyy-MM-dd"),
      label: format(weekStart, "d MMM"),
      completed: tasks.filter((task) => {
        if (!task.completedAt) return false;
        const time = parseISO(task.completedAt).getTime();
        return time >= start && time < endTime;
      }).length,
      created: tasks.filter((task) => {
        const time = parseISO(task.createdAt).getTime();
        return time >= start && time < endTime;
      }).length,
    };
  });
}

export interface WorkloadPoint {
  memberId: ID;
  name: string;
  avatarHue: number;
  open: number;
  done: number;
  overdue: number;
}

export function workloadSeries(
  tasks: Task[],
  members: Member[],
  now = new Date(),
): WorkloadPoint[] {
  return members
    .map((member) => {
      const owned = tasks.filter((task) => task.assigneeId === member.id);
      return {
        memberId: member.id,
        name: member.name,
        avatarHue: member.avatarHue,
        open: owned.filter((task) => task.status !== "done").length,
        done: owned.filter((task) => task.status === "done").length,
        overdue: owned.filter((task) => isTaskOverdue(task, now)).length,
      };
    })
    .sort((a, b) => b.open - a.open);
}

export interface StatusPoint {
  status: TaskStatus;
  label: string;
  count: number;
}

export function statusSeries(tasks: Task[]): StatusPoint[] {
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    label: status.replace("_", " "),
    count: tasks.filter((task) => task.status === status).length,
  }));
}

export function prioritySeries(tasks: Task[]) {
  return (Object.keys(PRIORITY_META) as Priority[]).map((priority) => ({
    priority,
    label: PRIORITY_META[priority].label,
    count: tasks.filter((task) => task.priority === priority && task.status !== "done").length,
  }));
}

export function averageCycleTimeDays(tasks: Task[]): number {
  const completed = tasks.filter((task) => task.completedAt);
  if (completed.length === 0) return 0;
  const total = completed.reduce(
    (sum, task) =>
      sum + Math.max(0, differenceInCalendarDays(parseISO(task.completedAt!), parseISO(task.createdAt))),
    0,
  );
  return Math.round((total / completed.length) * 10) / 10;
}

export function completionRateTrend(tasks: Task[], now = new Date()): number {
  const thisWeek = completionSeries(tasks, 2, now);
  if (thisWeek.length < 2) return 0;
  const [previous, current] = thisWeek;
  if (previous.completed === 0) return current.completed > 0 ? 100 : 0;
  return Math.round(((current.completed - previous.completed) / previous.completed) * 100);
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((event) => isSameDay(parseISO(event.start), day))
    .sort((a, b) => a.start.localeCompare(b.start));
}
