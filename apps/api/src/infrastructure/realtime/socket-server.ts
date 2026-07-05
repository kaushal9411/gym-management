import type { Server as HttpServer } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';

import { isAllowedOrigin } from '../../core/http/cors-origin';
import { logger } from '../../core/logging/logger';
import { jwtService } from '../../core/security/jwt.service';

const tenantRoom = (tenantId: string) => `tenant:${tenantId}`;

let io: SocketIOServer | null = null;

/**
 * Foundation-phase Socket.IO wiring (Prompt 10) — real auth handshake and
 * tenant-room join work today; actual business event emitters (attendance
 * check-ins, live dashboard counters, chat) are added when those modules
 * are built. `emitToTenant`/`notifyTenant` below are the one thing already
 * wired end-to-end: the tenant-notifications module calls them so the
 * Notification Center updates live instead of only on next poll.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Authentication required'));

      const claims = jwtService.verifyAccessToken(token);
      socket.data.tenantId = claims.tenantId;
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { tenantId, userId } = socket.data as { tenantId: string; userId: string };
    void socket.join(tenantRoom(tenantId));
    socket.emit('connected', { socketId: socket.id, tenantId, userId });
    logger.info('Socket connected', { tenantId, userId, socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { tenantId, userId, socketId: socket.id });
    });
  });

  return io;
}

/** Push a real-time event to every connected client for one tenant — used by tenant-notifications today, open for future modules. */
export function emitToTenant(tenantId: string, event: string, payload: unknown): void {
  io?.to(tenantRoom(tenantId)).emit(event, payload);
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
