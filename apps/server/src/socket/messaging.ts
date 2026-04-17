import type { Namespace, Socket } from "socket.io";
import type {
  MessagingClientToServer,
  MessagingServerToClient,
} from "@leetconnect/types";
import { db } from "../db/index.js";
import { messages, dmThreads, dmMessages, users } from "../db/schema.js";
import { eq, and, or } from "drizzle-orm";

type MessagingSocket = Socket<
  MessagingClientToServer,
  MessagingServerToClient
>;
type MessagingNS = Namespace<MessagingClientToServer, MessagingServerToClient>;

export function registerMessagingHandlers(ns: MessagingNS): void {
  ns.on("connection", (socket: MessagingSocket) => {
    const userId: string = (socket.data as { userId: string }).userId;

    socket.on("join_channel", (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on("join_dm_thread", (threadId: string) => {
      socket.join(`dm:${threadId}`);
    });

    socket.on("send_message", async (payload) => {
      const { channelId, content } = payload;

      if (!content.trim() || content.length > 2000) return;

      const [row] = await db
        .insert(messages)
        .values({ channelId, senderId: userId, content: content.trim() })
        .returning();

      if (!row) return;

      const [sender] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!sender) return;

      ns.to(`channel:${channelId}`).emit("new_message", {
        id: row.id,
        channelId: row.channelId,
        sender,
        content: row.content,
        type: row.type,
        deletedAt: null,
        createdAt: row.createdAt.toISOString(),
      });
    });

    socket.on("send_dm", async (payload) => {
      const { threadId, content } = payload;

      if (!content.trim() || content.length > 2000) return;

      // Verify user is part of this thread
      const [thread] = await db
        .select()
        .from(dmThreads)
        .where(
          and(
            eq(dmThreads.id, threadId),
            or(
              eq(dmThreads.participantA, userId),
              eq(dmThreads.participantB, userId)
            )
          )
        )
        .limit(1);

      if (!thread) return;

      const [row] = await db
        .insert(dmMessages)
        .values({ threadId, senderId: userId, content: content.trim() })
        .returning();

      if (!row) return;

      const [sender] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!sender) return;

      ns.to(`dm:${threadId}`).emit("new_dm", {
        id: row.id,
        threadId: row.threadId,
        sender,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      });
    });

    socket.on("typing_start", async (payload) => {
      const [sender] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!sender) return;

      if (payload.channelId) {
        socket.to(`channel:${payload.channelId}`).emit("typing_indicator", {
          userId,
          displayName: sender.displayName,
          channelId: payload.channelId,
        });
      } else if (payload.threadId) {
        socket.to(`dm:${payload.threadId}`).emit("typing_indicator", {
          userId,
          displayName: sender.displayName,
          threadId: payload.threadId,
        });
      }
    });
  });
}
