import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { authenticateToken, assertPermission } from '../middleware/auth.js';

export const companyRoom = (companyId: string) => `company:${companyId}`;

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: env.corsOrigin, methods: ['GET', 'POST'], credentials: true } });
  io.use(async (socket, next) => {
    const header = socket.handshake.headers.authorization;
    const token = socket.handshake.auth?.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));
    try {
      const user = await authenticateToken(token);
      assertPermission(user, 'orders:read');
      socket.data.user = user;
      socket.data.token = token;
      next();
    } catch { next(new Error('Authentication or permission denied')); }
  });
  io.on('connection', (socket) => {
    void socket.join(companyRoom(socket.data.user.companyId));
    // Recheck database state on every inbound event, including room requests.
    socket.use(async (_packet, next) => {
      try {
        socket.data.user = await authenticateToken(socket.data.token);
        assertPermission(socket.data.user, 'orders:read');
        next();
      } catch {
        next(new Error('Authentication or permission denied'));
        socket.disconnect(true);
      }
    });
    socket.on('join-company-room', (request: unknown) => {
      const companyId = typeof request === 'object' && request !== null && 'companyId' in request ? request.companyId : undefined;
      if (companyId !== socket.data.user.companyId) {
        socket.emit('error', { message: 'You do not have access to this company room' });
        return;
      }
      void socket.join(companyRoom(socket.data.user.companyId));
      socket.emit('company-room-joined', { companyId: socket.data.user.companyId });
    });
    // Packet middleware reports errors here; do not expose internal exceptions.
    socket.on('error', () => undefined);
  });
  return io;
}

export async function emitTenantEvent(io: Server, companyId: string, eventName: string, payload: unknown): Promise<void> {
  const room = companyRoom(companyId);
  const sockets = await io.in(room).fetchSockets();
  // Already-connected users may have been disabled or had grants revoked.
  await Promise.all(sockets.map(async (socket) => {
    try {
      const user = await authenticateToken(socket.data.token);
      assertPermission(user, 'orders:read');
      if (user.companyId !== companyId) throw new Error('Tenant mismatch');
    } catch { socket.disconnect(true); }
  }));
  io.to(room).emit(eventName, payload);
}
