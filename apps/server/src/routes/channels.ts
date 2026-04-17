import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  channels,
  messages,
  problemRooms,
  users,
} from "../db/schema.js";
import { eq, desc, lt, and } from "drizzle-orm";

/** Auto-create default channels for a new problem room */
export async function ensureDefaultChannels(roomId: string): Promise<void> {
  const existing = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.roomId, roomId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(channels).values([
    { roomId, name: "general", type: "text", position: 0 },
    { roomId, name: "hints", type: "text", position: 1 },
    { roomId, name: "solutions", type: "text", position: 2 },
    { roomId, name: "Voice 1", type: "voice", position: 3 },
    { roomId, name: "Voice 2", type: "voice", position: 4 },
  ]);
}

/** Get or create a problem room by slug */
export async function getOrCreateRoom(slug: string) {
  let [room] = await db
    .select()
    .from(problemRooms)
    .where(eq(problemRooms.problemSlug, slug))
    .limit(1);

  if (!room) {
    [room] = await db
      .insert(problemRooms)
      .values({ problemSlug: slug })
      .returning();
  }

  if (!room) throw new Error("Failed to create room");

  await ensureDefaultChannels(room.id);
  return room;
}

export async function channelRoutes(fastify: FastifyInstance): Promise<void> {
  // Get room + channels by problem slug
  fastify.get<{ Params: { slug: string } }>(
    "/rooms/:slug",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const room = await getOrCreateRoom(request.params.slug);
      const roomChannels = await db
        .select()
        .from(channels)
        .where(eq(channels.roomId, room.id))
        .orderBy(channels.position);

      return { room, channels: roomChannels };
    }
  );

  // Get message history for a channel (cursor-based pagination)
  fastify.get<{
    Params: { channelId: string };
    Querystring: { cursor?: string; limit?: string };
  }>(
    "/channels/:channelId/messages",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const limit = Math.min(parseInt(request.query.limit ?? "50"), 100);
      const cursor = request.query.cursor;

      const conditions = [eq(messages.channelId, request.params.channelId)];
      if (cursor) {
        conditions.push(lt(messages.createdAt, new Date(cursor)));
      }

      const rows = await db
        .select({
          id: messages.id,
          channelId: messages.channelId,
          content: messages.content,
          type: messages.type,
          deletedAt: messages.deletedAt,
          createdAt: messages.createdAt,
          senderId: users.id,
          senderName: users.displayName,
          senderAvatar: users.avatarUrl,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;

      return {
        messages: data.map((r) => ({
          id: r.id,
          channelId: r.channelId,
          sender: {
            id: r.senderId,
            displayName: r.senderName,
            avatarUrl: r.senderAvatar,
          },
          content: r.content,
          type: r.type,
          deletedAt: r.deletedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
        hasMore,
        cursor: data.at(-1)?.createdAt.toISOString() ?? null,
      };
    }
  );
}
