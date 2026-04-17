import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { User } from "@leetconnect/types";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    // Use a separate property to avoid conflicting with @fastify/jwt's `user` declaration
    currentUser: User;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as { sub: string };
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, payload.sub))
          .limit(1);

        if (!dbUser) {
          return reply.code(401).send({ error: "User not found" });
        }

        request.currentUser = {
          id: dbUser.id,
          googleId: dbUser.googleId,
          displayName: dbUser.displayName,
          avatarUrl: dbUser.avatarUrl,
          leetcodeHandle: dbUser.leetcodeHandle,
          createdAt: dbUser.createdAt.toISOString(),
        };
      } catch {
        reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );
});
