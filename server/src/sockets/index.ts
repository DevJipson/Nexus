import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Pool } from "pg";
import { SESSION_COOKIE_NAME } from "../lib/session-cookie";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import type { SessionService } from "../modules/auth/session.service";
import type { WorkspaceService } from "../modules/workspaces/workspaces.service";
import type { ConversationService } from "../modules/conversations/conversations.service";
import { setSocketIo, emitters } from "./emitters";

/**
 * Authenticated Socket.IO server.
 *
 * Authorization:
 * - Handshake cookie is validated against the same session store as HTTP auth.
 * - Rooms are never joined client-side; the server verifies workspace or
 *   conversation membership on subscribe.
 * - Presence is in-memory (D10): accurate for single-node deploys; multi-node
 *   requires a Redis adapter.
 */

export interface SocketDeps {
  env: Env;
  logger: Logger;
  pool: Pool;
  sessions: SessionService;
  workspaces: WorkspaceService;
  conversations: ConversationService;
}

type SocketData = { userId: string; email: string; name: string; workspaceIds: string[] };

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function findUserWorkspaceIds(pool: Pool, userId: string): Promise<string[]> {
  const result = await pool.query<{ workspace_id: string }>(
    "SELECT workspace_id FROM workspace_members WHERE user_id = $1",
    [userId],
  );
  return result.rows.map((r) => r.workspace_id);
}

export function createSocketServer(httpServer: HttpServer, deps: SocketDeps): Server {
  const { env, logger, pool, sessions, workspaces, conversations } = deps;

  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token) ||
        parseCookie(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
      if (!token) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      const resolved = await sessions.resolve(token);
      if (!resolved) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      const workspaceIds = await findUserWorkspaceIds(pool, resolved.session.user_id);
      socket.data = { userId: resolved.session.user_id, email: resolved.user.email, name: resolved.user.name, workspaceIds };
      next();
    } catch (error) {
      logger.error({ err: error }, "socket authentication failed");
      next(new Error("UNAUTHENTICATED"));
    }
  });

  const connected = new Map<string, Set<string>>();

  io.on("connection", (socket) => {
    const { userId, workspaceIds } = socket.data as SocketData;

    // Auto-join the personal room for direct notifications.
    socket.join(`user:${userId}`);

    // Track in-memory presence; only broadcast when a user goes online/offline.
    const before = connected.get(userId);
    if (!before) {
      connected.set(userId, new Set([socket.id]));
      for (const workspaceId of workspaceIds) {
        io.to(`workspace:${workspaceId}`).emit("presence:update", { userId, presence: "online" });
      }
    } else {
      connected.get(userId)!.add(socket.id);
    }

    logger.debug({ userId, socketId: socket.id }, "socket connected");

    socket.on("workspace:subscribe", async (payload: { workspaceId?: string }, callback?: (error: string | null, ok: boolean) => void) => {
      const workspaceId = payload?.workspaceId;
      if (typeof workspaceId !== "string") {
        callback?.("INVALID_PAYLOAD", false);
        return;
      }
      try {
        await workspaces.requireMembership(workspaceId, userId);
        await socket.join(`workspace:${workspaceId}`);
        callback?.(null, true);
      } catch (error) {
        logger.warn({ err: error, workspaceId, userId }, "workspace subscribe denied");
        callback?.("FORBIDDEN", false);
      }
    });

    socket.on("conversation:subscribe", async (payload: { conversationId?: string }, callback?: (error: string | null, ok: boolean) => void) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId !== "string") {
        callback?.("INVALID_PAYLOAD", false);
        return;
      }
      try {
        await conversations.requireConversationAccess(conversationId, userId);
        await socket.join(`conversation:${conversationId}`);
        callback?.(null, true);
      } catch (error) {
        logger.warn({ err: error, conversationId, userId }, "conversation subscribe denied");
        callback?.("FORBIDDEN", false);
      }
    });

    socket.on("presence:heartbeat", () => {
      // Keep-alive; could update presence state here for 'away' handling later.
    });

    socket.on("typing", async (payload: { conversationId?: string; isTyping?: boolean }) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId !== "string") return;
      try {
        await conversations.requireConversationAccess(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit("typing", { userId, conversationId, isTyping: Boolean(payload.isTyping) });
      } catch {
        // Ignore invalid subscriptions; clients must subscribe first.
      }
    });

    socket.on("workspace:unsubscribe", (payload: { workspaceId?: string }) => {
      if (typeof payload?.workspaceId === "string") {
        socket.leave(`workspace:${payload.workspaceId}`);
      }
    });

    socket.on("conversation:unsubscribe", (payload: { conversationId?: string }) => {
      if (typeof payload?.conversationId === "string") {
        socket.leave(`conversation:${payload.conversationId}`);
      }
    });

    socket.on("disconnect", (reason) => {
      const sockets = connected.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        connected.delete(userId);
        for (const workspaceId of workspaceIds) {
          io.to(`workspace:${workspaceId}`).emit("presence:update", { userId, presence: "offline" });
        }
      }
      logger.debug({ userId, reason }, "socket disconnected");
    });
  });

  setSocketIo(io);
  return io;
}

// Re-exported for callsites that prefer importing from sockets module.
export { emitters };
