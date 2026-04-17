import { io, type Socket } from "socket.io-client";
import type {
  PresenceClientToServer,
  PresenceServerToClient,
  MessagingClientToServer,
  MessagingServerToClient,
  VoiceClientToServer,
  VoiceServerToClient,
} from "@leetconnect/types";

const SOCKET_URL =
  (import.meta.env["VITE_SOCKET_URL"] as string | undefined) ??
  "ws://localhost:3001";

type PresenceSocket = Socket<PresenceServerToClient, PresenceClientToServer>;
type MessagingSocket = Socket<MessagingServerToClient, MessagingClientToServer>;
type VoiceSocket = Socket<VoiceServerToClient, VoiceClientToServer>;

let presenceSocket: PresenceSocket | null = null;
let messagingSocket: MessagingSocket | null = null;
let voiceSocket: VoiceSocket | null = null;

function createSocket<S extends Socket>(
  namespace: string,
  token: string
): S {
  return io(`${SOCKET_URL}/${namespace}`, {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  }) as unknown as S;
}

export function initSockets(token: string): void {
  disconnectSockets();

  presenceSocket = createSocket<PresenceSocket>("presence", token);
  messagingSocket = createSocket<MessagingSocket>("messaging", token);
  voiceSocket = createSocket<VoiceSocket>("voice", token);
}

export function disconnectSockets(): void {
  presenceSocket?.disconnect();
  messagingSocket?.disconnect();
  voiceSocket?.disconnect();
  presenceSocket = null;
  messagingSocket = null;
  voiceSocket = null;
}

export function getPresenceSocket(): PresenceSocket {
  if (!presenceSocket) throw new Error("Presence socket not initialized");
  return presenceSocket;
}

export function getMessagingSocket(): MessagingSocket {
  if (!messagingSocket) throw new Error("Messaging socket not initialized");
  return messagingSocket;
}

export function getVoiceSocket(): VoiceSocket {
  if (!voiceSocket) throw new Error("Voice socket not initialized");
  return voiceSocket;
}
