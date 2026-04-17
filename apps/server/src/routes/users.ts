import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, ilike, or } from "drizzle-orm";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Search users
  fastify.get<{ Querystring: { q: string } }>(
    "/users/search",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { q } = request.query;
      if (!q || q.length < 2) {
        return reply.code(400).send({ error: "Query must be at least 2 chars" });
      }

      const results = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          leetcodeHandle: users.leetcodeHandle,
        })
        .from(users)
        .where(
          or(
            ilike(users.displayName, `%${q}%`),
            ilike(users.leetcodeHandle, `%${q}%`)
          )
        )
        .limit(20);

      return { users: results };
    }
  );

  // Get user by ID
  fastify.get<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          leetcodeHandle: users.leetcodeHandle,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, request.params.id))
        .limit(1);

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return { user };
    }
  );

  // Update LeetCode handle
  fastify.put<{ Body: { leetcodeHandle: string } }>(
    "/users/me/leetcode",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { leetcodeHandle } = request.body;

      if (!leetcodeHandle || leetcodeHandle.length < 1) {
        return reply.code(400).send({ error: "Invalid handle" });
      }

      await db
        .update(users)
        .set({ leetcodeHandle, updatedAt: new Date() })
        .where(eq(users.id, request.currentUser.id));

      return { success: true };
    }
  );
}
