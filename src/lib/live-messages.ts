/**
 * Live messaging state (Phase 4) — talks to the NEXUS backend over HTTP and
 * Socket.IO. Entirely in-memory: unlike the local demo store nothing here is
 * persisted to localStorage; the server is the source of truth.
 *
 * Activated only when `NEXT_PUBLIC_NEXUS_API_URL` is set (see `isBackendEnabled`).
 * Shapes mirror the server DTOs (`server/src/types/api.ts`).
 */
import { create } from "zustand";
import { api, ApiError, isBackendEnabled } from "./api";
import { disconnectSocket, getSocket } from "./socket";
import type { Member, WorkspaceRole } from "@/types/domain";

export interface LiveConversation {
  id: string;
  workspaceId: string;
  kind: "direct" | "group";
  name: string | null;
  participantIds: string[];
  projectId: string | null;
  lastMessage: { id: string; authorId: string; body: string; createdAt: string } | null;
  unread: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveMessage {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionMe {
  id: string;
  name: string;
  email: string;
  avatarHue: number;
}

interface SessionWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberCount: number;
}

export type LiveStatus = "idle" | "loading" | "anonymous" | "ready" | "error";

interface LiveMessagesState {
  status: LiveStatus;
  error: string | null;
  me: SessionMe | null;
  workspaces: SessionWorkspace[];
  workspaceId: string | null;
  members: Member[];
  conversations: LiveConversation[];
  messagesById: Record<string, LiveMessage[]>;
  selectedId: string | null;
  /** conversationId -> userId -> epoch ms at which the typing hint expires. */
  typing: Record<string, Record<string, number>>;
  creating: boolean;

  bootstrap(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  selectWorkspace(workspaceId: string): Promise<void>;
  selectConversation(conversationId: string | null): void;
  openConversation(conversationId: string): Promise<void>;
  send(body: string): Promise<void>;
  createConversation(input: {
    kind: "direct" | "group";
    name?: string;
    participantIds: string[];
    firstMessage?: string;
  }): Promise<string | null>;
  noteTyping(isTyping: boolean): void;
  _upsertConversation(conversation: LiveConversation): void;
  _appendMessage(message: LiveMessage): void;
  _patchPresence(userId: string, presence: Member["presence"]): void;
}

const sortConversations = (list: LiveConversation[]) =>
  [...list].sort((a, b) =>
    (b.lastMessage?.createdAt ?? b.createdAt).localeCompare(a.lastMessage?.createdAt ?? a.createdAt),
  );

let socketWired = false;
let lastTypingEmitAt = 0;

export const useLiveMessages = create<LiveMessagesState>()((set, get) => {
  const apiCall = <T>(path: string, options?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; json?: unknown }) =>
    api<T>(path, options);

  function wireSocket(): void {
    const socket = getSocket();
    if (!socket || socketWired) return;
    socketWired = true;

    socket.on("connect", () => {
      const { workspaceId, selectedId } = get();
      if (workspaceId) socket.emit("workspace:subscribe", { workspaceId });
      if (selectedId) socket.emit("conversation:subscribe", { conversationId: selectedId });
    });

    socket.on("conversation:new", (payload: { conversation?: LiveConversation }) => {
      if (payload.conversation) get()._upsertConversation(payload.conversation);
    });

    socket.on("message:new", (payload: { message?: LiveMessage }) => {
      if (payload.message) get()._appendMessage(payload.message);
    });

    socket.on("presence:update", (payload: { userId?: string; presence?: Member["presence"] }) => {
      if (payload.userId && payload.presence) get()._patchPresence(payload.userId, payload.presence);
    });

    socket.on("typing", (payload: { userId?: string; conversationId?: string; isTyping?: boolean }) => {
      const { userId, conversationId, isTyping } = payload;
      if (!userId || !conversationId) return;
      set((state) => {
        const thread = { ...(state.typing[conversationId] ?? {}) };
        if (isTyping) thread[userId] = Date.now() + 4_000;
        else delete thread[userId];
        return { typing: { ...state.typing, [conversationId]: thread } };
      });
    });
  }

  async function loadWorkspace(workspaceId: string): Promise<void> {
    const [{ members }, { conversations }] = await Promise.all([
      apiCall<{ members: Member[] }>(`/api/v1/workspaces/${workspaceId}/members`),
      apiCall<{ conversations: LiveConversation[] }>(`/api/v1/workspaces/${workspaceId}/conversations`),
    ]);
    set({ workspaceId, members, conversations: sortConversations(conversations), messagesById: {}, typing: {} });
    const socket = getSocket();
    socket?.emit("workspace:subscribe", { workspaceId });
  }

  return {
    status: "idle",
    error: null,
    me: null,
    workspaces: [],
    workspaceId: null,
    members: [],
    conversations: [],
    messagesById: {},
    selectedId: null,
    typing: {},
    creating: false,

    async bootstrap() {
      if (!isBackendEnabled) {
        set({ status: "anonymous" });
        return;
      }
      if (get().status === "ready" && get().me) return;
      if (get().status === "loading") return;
      set({ status: "loading", error: null });
      try {
        const me = await apiCall<{ user: SessionMe; workspaces: SessionWorkspace[] }>("/api/v1/me");
        wireSocket();
        set({ me: me.user, workspaces: me.workspaces, status: "ready" });
        const first = me.workspaces[0];
        if (first) await loadWorkspace(first.id);
        set({ status: "ready" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          set({ status: "anonymous", me: null, workspaces: [] });
          return;
        }
        set({ status: "error", error: error instanceof Error ? error.message : "Could not reach the NEXUS API." });
      }
    },

    async signIn(email, password) {
      set({ status: "loading", error: null });
      try {
        await apiCall("/api/v1/auth/login", { method: "POST", json: { email, password } });
        const me = await apiCall<{ user: SessionMe; workspaces: SessionWorkspace[] }>("/api/v1/me");
        wireSocket();
        set({ me: me.user, workspaces: me.workspaces, status: "ready" });
        const first = me.workspaces[0];
        if (first) await loadWorkspace(first.id);
        set({ status: "ready" });
      } catch (error) {
        const message =
          error instanceof ApiError && error.status === 401
            ? "That email and password don't match. Try again."
            : error instanceof Error
              ? error.message
              : "Could not sign in.";
        set({ status: "anonymous", error: message });
      }
    },

    async signOut() {
      try {
        await apiCall("/api/v1/auth/logout", { method: "POST" });
      } catch {
        // Even if the server is unreachable, drop local state.
      }
      disconnectSocket();
      socketWired = false;
      set({
        status: "anonymous",
        me: null,
        workspaces: [],
        workspaceId: null,
        members: [],
        conversations: [],
        messagesById: {},
        selectedId: null,
        typing: {},
      });
    },

    async selectWorkspace(workspaceId) {
      if (workspaceId === get().workspaceId) return;
      set({ status: "loading", selectedId: null });
      try {
        await loadWorkspace(workspaceId);
        set({ status: "ready" });
      } catch (error) {
        set({ status: "error", error: error instanceof Error ? error.message : "Could not load the workspace." });
      }
    },

    selectConversation(conversationId) {
      set({ selectedId: conversationId });
      const socket = getSocket();
      if (socket && conversationId) socket.emit("conversation:subscribe", { conversationId });
    },

    async openConversation(conversationId) {
      set({ selectedId: conversationId });
      const socket = getSocket();
      socket?.emit("conversation:subscribe", { conversationId });
      try {
        const { messages } = await apiCall<{ messages: LiveMessage[] }>(
          `/api/v1/conversations/${conversationId}/messages`,
        );
        set((state) => ({ messagesById: { ...state.messagesById, [conversationId]: messages } }));
        // Read receipts are server-authoritative; mirror the count locally.
        await apiCall(`/api/v1/conversations/${conversationId}/read`, { method: "POST" });
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : "Could not open the conversation." });
      }
    },

    async send(body) {
      const { selectedId } = get();
      const text = body.trim();
      if (!selectedId || !text) return;
      try {
        const { message } = await apiCall<{ message: LiveMessage }>(`/api/v1/conversations/${selectedId}/messages`, {
          method: "POST",
          json: { body: text },
        });
        get()._appendMessage(message);
        // The author has implicitly read the thread.
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === selectedId ? { ...c, unread: 0 } : c)),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : "Could not send the message." });
      }
    },

    async createConversation(input) {
      const { workspaceId } = get();
      if (!workspaceId) return null;
      set({ creating: true, error: null });
      try {
        const { conversation } = await apiCall<{ conversation: LiveConversation }>(
          `/api/v1/workspaces/${workspaceId}/conversations`,
          { method: "POST", json: input },
        );
        get()._upsertConversation(conversation);
        set({ creating: false });
        await get().openConversation(conversation.id);
        return conversation.id;
      } catch (error) {
        set({ creating: false, error: error instanceof Error ? error.message : "Could not create the conversation." });
        return null;
      }
    },

    noteTyping(isTyping) {
      const { selectedId } = get();
      const socket = getSocket();
      if (!selectedId || !socket) return;
      const now = Date.now();
      if (isTyping && now - lastTypingEmitAt < 1_500) return;
      lastTypingEmitAt = now;
      socket.emit("typing", { conversationId: selectedId, isTyping });
    },

    _upsertConversation(conversation) {
      set((state) => {
        if (state.workspaceId !== conversation.workspaceId) return state;
        const rest = state.conversations.filter((c) => c.id !== conversation.id);
        return { conversations: sortConversations([conversation, ...rest]) };
      });
    },

    _appendMessage(message) {
      const state = get();
      const meId = state.me?.id;
      const viewing = state.selectedId === message.conversationId && meId !== undefined && message.authorId !== meId;
      set((current) => {
        const existing = current.messagesById[message.conversationId];
        const thread = existing ? [...existing] : undefined;
        if (thread && !thread.some((m) => m.id === message.id)) thread.push(message);

        const fromSelf = meId !== undefined && message.authorId === meId;
        const conversations = current.conversations.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessage: { id: message.id, authorId: message.authorId, body: message.body, createdAt: message.createdAt },
                unread: fromSelf ? c.unread : viewing ? 0 : c.unread + 1,
              }
            : c,
        );

        return {
          messagesById: thread ? { ...current.messagesById, [message.conversationId]: thread } : current.messagesById,
          conversations: sortConversations(conversations),
        };
      });
      if (viewing) {
        // Keep the server-side read receipt in sync with what the user is watching.
        void apiCall(`/api/v1/conversations/${message.conversationId}/read`, { method: "POST" }).catch(() => undefined);
      }
    },

    _patchPresence(userId, presence) {
      set((state) => ({
        members: state.members.map((member) => (member.id === userId ? { ...member, presence } : member)),
      }));
    },
  };
});
