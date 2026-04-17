import "dotenv/config";
import "./config.js"; // validate env early
import Fastify from "fastify";
import jwtPlugin from "@fastify/jwt";
import cookiePlugin from "@fastify/cookie";
import { config } from "./config.js";
import corsPlugin from "./plugins/cors.js";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { channelRoutes } from "./routes/channels.js";
import { friendRoutes } from "./routes/friends.js";
import { createSocketServer } from "./socket/index.js";
import {
  redis,
  redisPublisher,
  redisSubscriber,
} from "./redis/index.js";

async function bootstrap() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "warn" : "info",
    },
  });

  // Connect Redis
  await Promise.all([
    redis.connect(),
    redisPublisher.connect(),
    redisSubscriber.connect(),
  ]);

  // Register plugins
  await fastify.register(cookiePlugin);
  await fastify.register(jwtPlugin, { secret: config.JWT_SECRET });
  await fastify.register(corsPlugin);
  await fastify.register(authPlugin);

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(channelRoutes);
  await fastify.register(friendRoutes);

  // Health check
  fastify.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  // Start HTTP server first, then attach Socket.io
  await fastify.listen({ port: config.PORT, host: "0.0.0.0" });

  createSocketServer(fastify);

  fastify.log.info(`LeetConnect server running on port ${config.PORT}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
