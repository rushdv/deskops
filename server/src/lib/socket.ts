import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { AuthService } from '../services/auth.service.js';
import { UserSessionPayload } from '../types/auth.js';
import { config } from '../config/index.js';

let io: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
  data: {
    user: UserSessionPayload;
  };
}

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // JWT Handshake Authentication Middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.substring(7)
        : null);

    if (!token) {
      return next(new Error('UNAUTHORIZED: Authentication token required for WebSocket connection.'));
    }

    try {
      const user = AuthService.verifyAccessToken(token);
      (socket as AuthenticatedSocket).data = { user };
      next();
    } catch (err) {
      next(new Error('UNAUTHORIZED: Invalid or expired WebSocket authentication token.'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;

    // 1. Auto-join isolated tenant room (NFR-01)
    const tenantRoom = `tenant:${user.organisationId}`;
    socket.join(tenantRoom);

    // 2. Client-managed ticket room subscriptions
    socket.on('join:ticket', (ticketId: string) => {
      if (ticketId) {
        socket.join(`ticket:${ticketId}`);
      }
    });

    socket.on('leave:ticket', (ticketId: string) => {
      if (ticketId) {
        socket.leave(`ticket:${ticketId}`);
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer | null => io;

/**
 * Broadcast event safely scoped to tenant and ticket rooms (FR-1.06)
 */
export const emitTicketEvent = (
  organisationId: string,
  ticketId: string,
  eventName: string,
  payload: unknown
): void => {
  if (io) {
    io.to(`tenant:${organisationId}`).to(`ticket:${ticketId}`).emit(eventName, payload);
  }
};
