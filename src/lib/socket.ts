/**
 * Singleton Socket.IO client for the live backend.
 *
 * Only constructed when the backend is configured; the handshake carries the
 * session cookie (same-site localhost or same-origin deployment), and the
 * server joins this socket to `user:{id}` automatically. Feature code must
 * gate on `isBackendEnabled` — the local demo never opens a socket.
 */
import { io, type Socket } from "socket.io-client";
import { API_URL, isBackendEnabled } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!isBackendEnabled) return null;
  socket ??= io(API_URL as string, {
    withCredentials: true,
    // WebSocket first for latency; polling fallback keeps strict proxies working.
    transports: ["websocket", "polling"],
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
