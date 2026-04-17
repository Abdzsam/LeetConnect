import type { Namespace, Socket } from "socket.io";
import type {
  VoiceClientToServer,
  VoiceServerToClient,
} from "@leetconnect/types";
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  getVoiceParticipants,
} from "../redis/index.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

type VoiceSocket = Socket<VoiceClientToServer, VoiceServerToClient>;
type VoiceNS = Namespace<VoiceClientToServer, VoiceServerToClient>;

/** Track which voice channel each socket is in */
const socketVoiceChannel = new Map<string, string>();

export function registerVoiceHandlers(ns: VoiceNS): void {
  ns.on("connection", (socket: VoiceSocket) => {
    const userId: string = (socket.data as { userId: string }).userId;

    socket.on("join_voice_channel", async (channelId: string) => {
      // Leave any existing voice channel first
      const prevChannel = socketVoiceChannel.get(socket.id);
      if (prevChannel) {
        await leaveVoiceChannel(prevChannel, userId);
        socket.leave(`voice:${prevChannel}`);
        ns.to(`voice:${prevChannel}`).emit("peer_left", userId);
      }

      // Get list of existing peers BEFORE joining
      const existingPeerIds = await getVoiceParticipants(channelId);

      // Join new channel
      await joinVoiceChannel(channelId, userId);
      socket.join(`voice:${channelId}`);
      socketVoiceChannel.set(socket.id, channelId);

      // Send existing peers to the joining user
      socket.emit("voice_peers", existingPeerIds);

      // Notify existing peers of the new joiner
      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        socket.to(`voice:${channelId}`).emit("peer_joined", {
          userId,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        });
      }
    });

    socket.on("leave_voice_channel", async (channelId: string) => {
      await leaveVoiceChannel(channelId, userId);
      socket.leave(`voice:${channelId}`);
      socketVoiceChannel.delete(socket.id);
      ns.to(`voice:${channelId}`).emit("peer_left", userId);
    });

    // WebRTC signaling — server just routes these between peers

    socket.on("offer", (payload) => {
      const targetSocket = findSocketByUserId(ns, payload.to);
      targetSocket?.emit("offer", { from: userId, sdp: payload.sdp });
    });

    socket.on("answer", (payload) => {
      const targetSocket = findSocketByUserId(ns, payload.to);
      targetSocket?.emit("answer", { from: userId, sdp: payload.sdp });
    });

    socket.on("ice_candidate", (payload) => {
      const targetSocket = findSocketByUserId(ns, payload.to);
      targetSocket?.emit("ice_candidate", {
        from: userId,
        candidate: payload.candidate,
      });
    });

    socket.on("disconnect", async () => {
      const channelId = socketVoiceChannel.get(socket.id);
      if (channelId) {
        await leaveVoiceChannel(channelId, userId);
        ns.to(`voice:${channelId}`).emit("peer_left", userId);
        socketVoiceChannel.delete(socket.id);
      }
    });
  });
}

function findSocketByUserId(ns: VoiceNS, targetUserId: string): VoiceSocket | undefined {
  for (const [, socket] of ns.sockets) {
    const sid = (socket.data as { userId?: string }).userId;
    if (sid === targetUserId) return socket as unknown as VoiceSocket;
  }
  return undefined;
}
