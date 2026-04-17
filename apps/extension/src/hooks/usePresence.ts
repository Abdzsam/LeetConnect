import { useEffect, useState } from "react";
import { getPresenceSocket } from "../lib/socket.js";
import type { OnlineUser } from "@leetconnect/types";

export function usePresence(slug: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!slug) {
      setOnlineUsers([]);
      return;
    }

    let socket: ReturnType<typeof getPresenceSocket>;
    try {
      socket = getPresenceSocket();
    } catch {
      return; // not yet authenticated
    }

    socket.emit("join_problem", slug);

    const heartbeatInterval = setInterval(() => {
      socket.emit("heartbeat", slug);
    }, 20_000);

    socket.on("room_users_updated", setOnlineUsers);
    socket.on("user_joined", (user) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    });
    socket.on("user_left", (userId) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    return () => {
      socket.emit("leave_problem", slug);
      clearInterval(heartbeatInterval);
      socket.off("room_users_updated");
      socket.off("user_joined");
      socket.off("user_left");
    };
  }, [slug]);

  return { onlineUsers };
}
