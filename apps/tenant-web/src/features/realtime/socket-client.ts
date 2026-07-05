import { io, type Socket } from 'socket.io-client';

/** The API's bare origin — NEXT_PUBLIC_API_URL includes the `/api/v1` prefix, which Socket.IO's own `path` option handles separately. */
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v\d+\/?$/, '');

let socket: Socket | null = null;

/**
 * One shared connection per tab, authenticated with the current access
 * token (verified server-side by the same `jwtService` the REST API uses —
 * see apps/api's socket-server.ts). Foundation-phase: the connection and
 * auth handshake work end-to-end today (proven by the Notification
 * Center's live updates); attendance/dashboard/chat event handlers are
 * added when those business modules exist.
 */
export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token: accessToken },
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
