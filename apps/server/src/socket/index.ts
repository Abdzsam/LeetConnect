import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { FastifyInstance } from "fastify";
import { redisPublisher, redisSubscriber } from "../redis/index.js";
import { registerPresenceHandlers } from "./presence.js";
import { registerMessagingHandlers } from "./messaging.js";
import { registerVoiceHandlers } from "./voice.js";
import { config } from "../config.js";

/** JWT middleware for Socket.io — validates token from auth handshake */
function createAuthMiddleware(fastify: FastifyInstance) {
  return (
    socket: { handshake: { auth: { token?: string } }; data: object; disconnect: (b: boolean) => void },
    next: (err?: Error) => void
  ) => {
    const token = socket.handshake.auth["token"];
    if (!token) {
      return next(new Error("No auth token"));
    }
    try {
      const payload = fastify.jwt.verify<{ sub: string }>(token);
      (socket.data as { userId: string }).userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  };
}

export function createSocketServer(
  fastify: FastifyInstance
): Server {
  const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  const io = new Server(fastify.server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Use Redis adapter for multi-instance scaling
  io.adapter(createAdapter(redisPublisher, redisSubscriber));

  const authMiddleware = createAuthMiddleware(fastify);

  // /presence namespace
  const presenceNS = io.of("/presence");
  presenceNS.use(authMiddleware as Parameters<typeof presenceNS.use>[0]);
  registerPresenceHandlers(presenceNS);

  // /messaging namespace
  const messagingNS = io.of("/messaging");
  messagingNS.use(authMiddleware as Parameters<typeof messagingNS.use>[0]);
  registerMessagingHandlers(messagingNS);

  // /voice namespace
  const voiceNS = io.of("/voice");
  voiceNS.use(authMiddleware as Parameters<typeof voiceNS.use>[0]);
  registerVoiceHandlers(voiceNS);

  return io;
}
