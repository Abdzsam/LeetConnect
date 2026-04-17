import { useEffect, useState, useCallback } from "react";
import { getMessagingSocket } from "../lib/socket.js";
import type { Message, DmMessage } from "@leetconnect/types";

const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3001";

export function useChannelMessages(channelId: string | null, accessToken: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!channelId || !accessToken) return;

    setIsLoading(true);
    setMessages([]);

    let socket: ReturnType<typeof getMessagingSocket>;
    try {
      socket = getMessagingSocket();
    } catch {
      setIsLoading(false);
      return;
    }

    socket.emit("join_channel", channelId);

    // Fetch history
    void fetch(`${API_URL}/channels/${channelId}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data: { messages: Message[] }) => {
        setMessages(data.messages.slice().reverse());
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    socket.on("new_message", (msg: Message) => {
      if (msg.channelId !== channelId) return;
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("new_message");
    };
  }, [channelId, accessToken]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!channelId || !content.trim()) return;
      let socket: ReturnType<typeof getMessagingSocket>;
      try {
        socket = getMessagingSocket();
      } catch {
        return;
      }
      socket.emit("send_message", { channelId, content });
    },
    [channelId]
  );

  return { messages, isLoading, sendMessage };
}

export function useDmMessages(threadId: string | null, accessToken: string | null) {
  const [messages, setMessages] = useState<DmMessage[]>([]);

  useEffect(() => {
    if (!threadId || !accessToken) return;

    let socket: ReturnType<typeof getMessagingSocket>;
    try {
      socket = getMessagingSocket();
    } catch {
      return;
    }

    socket.emit("join_dm_thread", threadId);

    socket.on("new_dm", (msg: DmMessage) => {
      if (msg.threadId !== threadId) return;
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("new_dm");
    };
  }, [threadId, accessToken]);

  const sendDm = useCallback(
    (content: string) => {
      if (!threadId || !content.trim()) return;
      let socket: ReturnType<typeof getMessagingSocket>;
      try {
        socket = getMessagingSocket();
      } catch {
        return;
      }
      socket.emit("send_dm", { threadId, content });
    },
    [threadId]
  );

  return { messages, sendDm };
}
