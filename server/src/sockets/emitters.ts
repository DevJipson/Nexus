import type { Server } from "socket.io";

/**
 * Typed emitters for Socket.IO events.
 *
 * All emitters no-op when the socket server has not been initialised — for
 * example in tests that don't expose a real socket server, and for production
 * during a graceful shutdown.
 */

type SocketInstance = Server;
let io: SocketInstance | null = null;

export function setSocketIo(instance: SocketInstance): void {
  io = instance;
}

export function getSocketIo(): SocketInstance | null {
  return io;
}

export function emitToRoom(room: string, event: string, payload: unknown): void {
  io?.to(room).emit(event, payload);
}

export function emitUserEvent(userId: string, event: string, payload: unknown): void {
  emitToRoom(`user:${userId}`, event, payload);
}

export function emitWorkspaceEvent(workspaceId: string, event: string, payload: unknown): void {
  emitToRoom(`workspace:${workspaceId}`, event, payload);
}

export function emitConversationEvent(conversationId: string, event: string, payload: unknown): void {
  emitToRoom(`conversation:${conversationId}`, event, payload);
}

// Convenience wrappers (keep callsites readable but close to raw events).
export const emitters = {
  messageNew(conversationId: string, payload: unknown) {
    emitConversationEvent(conversationId, "message:new", payload);
  },
  conversationNew(userId: string, payload: unknown) {
    emitUserEvent(userId, "conversation:new", payload);
  },
  notificationNew(userId: string, payload: unknown) {
    emitUserEvent(userId, "notification:new", payload);
  },
  presenceUpdate(userId: string, workspaceIds: string[], payload: unknown) {
    for (const workspaceId of workspaceIds) {
      emitWorkspaceEvent(workspaceId, "presence:update", payload);
    }
  },
  taskCreated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "task:created", payload);
  },
  taskUpdated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "task:updated", payload);
  },
  taskMoved(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "task:moved", payload);
  },
  taskDeleted(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "task:deleted", payload);
  },
  projectCreated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "project:created", payload);
  },
  projectUpdated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "project:updated", payload);
  },
  projectDeleted(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "project:deleted", payload);
  },
  eventCreated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "event:created", payload);
  },
  eventUpdated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "event:updated", payload);
  },
  eventDeleted(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "event:deleted", payload);
  },
  activityCreated(workspaceId: string, payload: unknown) {
    emitWorkspaceEvent(workspaceId, "activity:created", payload);
  },
};
