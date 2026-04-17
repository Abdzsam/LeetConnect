import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { friendships, users } from "../db/schema.js";
import { eq, or, and } from "drizzle-orm";

export async function friendRoutes(fastify: FastifyInstance): Promise<void> {
  // Send friend request
  fastify.post<{ Body: { addresseeId: string } }>(
    "/friends/request",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { addresseeId } = request.body;
      const requesterId = request.currentUser.id;

      if (requesterId === addresseeId) {
        return reply.code(400).send({ error: "Cannot friend yourself" });
      }

      // Check if already exists
      const [existing] = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(
              eq(friendships.requesterId, requesterId),
              eq(friendships.addresseeId, addresseeId)
            ),
            and(
              eq(friendships.requesterId, addresseeId),
              eq(friendships.addresseeId, requesterId)
            )
          )
        )
        .limit(1);

      if (existing) {
        return reply
          .code(409)
          .send({ error: "Friendship already exists", status: existing.status });
      }

      const [friendship] = await db
        .insert(friendships)
        .values({ requesterId, addresseeId })
        .returning();

      return { friendship };
    }
  );

  // Accept/reject friend request
  fastify.put<{
    Params: { id: string };
    Body: { action: "accept" | "reject" | "block" };
  }>(
    "/friends/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { action } = request.body;
      const userId = request.currentUser.id;

      const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, request.params.id))
        .limit(1);

      if (!friendship || friendship.addresseeId !== userId) {
        return reply.code(404).send({ error: "Friendship not found" });
      }

      if (action === "reject") {
        await db.delete(friendships).where(eq(friendships.id, friendship.id));
        return { success: true };
      }

      const status = action === "block" ? "blocked" : "accepted";
      const [updated] = await db
        .update(friendships)
        .set({ status, updatedAt: new Date() })
        .where(eq(friendships.id, friendship.id))
        .returning();

      return { friendship: updated };
    }
  );

  // List friends
  fastify.get(
    "/friends",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const userId = request.currentUser.id;

      const rows = await db
        .select({
          id: friendships.id,
          requesterId: friendships.requesterId,
          addresseeId: friendships.addresseeId,
          status: friendships.status,
          createdAt: friendships.createdAt,
          userId: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          leetcodeHandle: users.leetcodeHandle,
        })
        .from(friendships)
        .innerJoin(
          users,
          or(
            and(
              eq(friendships.requesterId, userId),
              eq(users.id, friendships.addresseeId)
            ),
            and(
              eq(friendships.addresseeId, userId),
              eq(users.id, friendships.requesterId)
            )
          )
        )
        .where(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId)
          )
        );

      return { friends: rows };
    }
  );
}
