import type { Namespace, Socket } from "socket.io";
import type {
  PresenceClientToServer,
  PresenceServerToClient,
} from "@leetconnect/types";
import {
  upsertPresence,
  removePresence,
  getLivePresence,
} from "../redis/index.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { User } from "@leetconnect/types";

type PresenceSocket = Socket<PresenceClientToServer, PresenceServerToClient>;
type PresenceNS = Namespace<PresenceClientToServer, PresenceServerToClient>;

/** Map from socketId to { userId, currentSlug } */
const socketMeta = new Map<
  string,
  { userId: string; currentSlug: string | null; user: User }
>();

export function registerPresenceHandlers(ns: PresenceNS): void {
  // Evict stale users every 5 seconds
  setInterval(async () => {
    const slugSet = new Set<string>();
    for (const meta of socketMeta.values()) {
      if (meta.currentSlug) slugSet.add(meta.currentSlug);
    }
    for (const slug of slugSet) {
      const liveUsers = await getLivePresence(slug);
      const room = `problem:${slug}`;
      ns.to(room).emit("room_users_updated", liveUsers);
    }
  }, 5_000);

  ns.on("connection", async (socket: PresenceSocket) => {
    const userId: string = (socket.data as { userId: string }).userId;

    // Load user info once on connect
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!dbUser) {
      socket.disconnect(true);
      return;
    }

    const userObj: User = {
      id: dbUser.id,
      googleId: dbUser.googleId,
      displayName: dbUser.displayName,
      avatarUrl: dbUser.avatarUrl,
      leetcodeHandle: dbUser.leetcodeHandle,
      createdAt: dbUser.createdAt.toISOString(),
    };

    socketMeta.set(socket.id, { userId, currentSlug: null, user: userObj });

    socket.on("join_problem", async (slug: string) => {
      const meta = socketMeta.get(socket.id);
      if (!meta) return;

      // Leave previous room
      if (meta.currentSlug) {
        await removePresence(meta.currentSlug, userId);
        socket.leave(`problem:${meta.currentSlug}`);
        ns
          .to(`problem:${meta.currentSlug}`)
          .emit("user_left", userId);
      }

      meta.currentSlug = slug;
      socketMeta.set(socket.id, meta);

      const onlineUser = {
        userId,
        displayName: dbUser.displayName,
        avatarUrl: dbUser.avatarUrl,
        joinedAt: Date.now(),
      };

      await upsertPresence(slug, onlineUser);
      socket.join(`problem:${slug}`);

      // Notify others
      socket.to(`problem:${slug}`).emit("user_joined", onlineUser);

      // Send full list to the joining user
      const allUsers = await getLivePresence(slug);
      socket.emit("room_users_updated", allUsers);
    });

    socket.on("leave_problem", async (slug: string) => {
      const meta = socketMeta.get(socket.id);
      if (!meta || meta.currentSlug !== slug) return;

      await removePresence(slug, userId);
      socket.leave(`problem:${slug}`);
      ns.to(`problem:${slug}`).emit("user_left", userId);
      meta.currentSlug = null;
    });

    socket.on("heartbeat", async (slug: string) => {
      const meta = socketMeta.get(socket.id);
      if (!meta || meta.currentSlug !== slug) return;

      await upsertPresence(slug, {
        userId,
        displayName: dbUser.displayName,
        avatarUrl: dbUser.avatarUrl,
        joinedAt: Date.now(),
      });
    });

    socket.on("disconnect", async () => {
      const meta = socketMeta.get(socket.id);
      if (meta?.currentSlug) {
        await removePresence(meta.currentSlug, userId);
        ns.to(`problem:${meta.currentSlug}`).emit("user_left", userId);
      }
      socketMeta.delete(socket.id);
    });
  });
}
