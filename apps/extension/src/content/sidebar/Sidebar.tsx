import { useState, useEffect, useRef } from "react";
import type { Channel, DmMessage } from "@leetconnect/types";
import { useAuth } from "../../hooks/useAuth.js";
import { usePresence } from "../../hooks/usePresence.js";
import { useChannelMessages, useDmMessages } from "../../hooks/useMessages.js";
import { useVoice } from "../../hooks/useVoice.js";
import { AuthGate } from "./AuthGate.js";
import { ChannelList } from "./ChannelList.js";
import { TextChannel } from "./TextChannel.js";
import { VoiceVideoChannel } from "./VoiceVideoChannel.js";
import { DirectMessage } from "./DirectMessage.js";
import { setShadowRoot } from "../../lib/webrtc.js";

const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3001";

type View =
  | { type: "channel"; channel: Channel }
  | { type: "dm"; threadId: string; otherUserId: string; otherUserName: string; otherUserAvatar: string | null }
  | { type: "dm_list" };

interface SidebarProps {
  slug: string | null;
  shadowRoot: ShadowRoot;
}

export function Sidebar({ slug, shadowRoot }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [view, setView] = useState<View | null>(null);
  const { user, tokens, isLoading, signIn } = useAuth();
  const { onlineUsers } = usePresence(user ? slug : null);
  const voice = useVoice();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShadowRoot(shadowRoot);
  }, [shadowRoot]);

  useEffect(() => {
    if (!slug || !user || !tokens) return;
    setView(null);
    setChannels([]);

    void fetch(`${API_URL}/rooms/${slug}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
      .then((r) => r.json())
      .then((data: { channels: Channel[] }) => {
        setChannels(data.channels);
        const first = data.channels.find((c) => c.type === "text");
        if (first) setView({ type: "channel", channel: first });
      })
      .catch(console.error);
  }, [slug, user, tokens]);

  const activeChannelId =
    view?.type === "channel" && view.channel.type === "text" ? view.channel.id : null;
  const activeDmThreadId = view?.type === "dm" ? view.threadId : null;

  const { messages, isLoading: msgsLoading, sendMessage } = useChannelMessages(
    activeChannelId,
    tokens?.accessToken ?? null
  );
  const { messages: dmMsgs, sendDm } = useDmMessages(
    activeDmThreadId,
    tokens?.accessToken ?? null
  );

  const problemTitle = slug
    ? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : null;

  // Toggle tab (always visible)
  const toggleTab = (
    <button
      onClick={() => setIsOpen((v) => !v)}
      className="absolute top-1/2 -translate-y-1/2 -left-6 w-6 h-16 flex flex-col items-center justify-center gap-0.5 rounded-l-lg shadow-lg transition-colors"
      style={{ background: "#2b2d31", borderLeft: "1px solid rgba(255,255,255,0.06)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      title={isOpen ? "Hide LeetConnect" : "Show LeetConnect"}
    >
      {/* Online badge */}
      {!isOpen && onlineUsers.length > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-lc-accent text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
          {onlineUsers.length}
        </span>
      )}
      {/* Chevron */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#949ba4"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );

  if (!isOpen) {
    return (
      <div className="relative w-0 h-full">
        {toggleTab}
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="relative flex flex-col h-full"
      style={{ width: "320px", background: "#1e1f22", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
    >
      {toggleTab}

      {/* Top header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ background: "#2b2d31", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-lc-accent flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="black">
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
            </svg>
          </div>
          <span className="text-lc-text font-bold text-sm">LeetConnect</span>
        </div>
        {onlineUsers.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-lc-online font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-lc-online" />
            {onlineUsers.length} online
          </span>
        )}
      </div>

      {/* Problem name bar */}
      {problemTitle && user && (
        <div
          className="px-3 py-1.5 flex-shrink-0"
          style={{ background: "#2b2d31", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11px] text-lc-text-muted truncate">
            <span className="text-lc-text-muted/50 mr-1">#</span>
            {problemTitle}
          </p>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-lc-text-muted text-xs">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
        ) : !user ? (
          <div className="flex-1">
            <AuthGate onSignIn={() => void signIn()} />
          </div>
        ) : !slug ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-lc-input/60 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#949ba4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <p className="text-lc-text-muted text-xs leading-relaxed">
              Open a LeetCode problem to join its room and connect with others.
            </p>
          </div>
        ) : (
          <>
            {/* Channel list sidebar */}
            <div
              className="flex-shrink-0 overflow-hidden"
              style={{ width: "150px", background: "#2b2d31", borderRight: "1px solid rgba(255,255,255,0.06)" }}
            >
              <ChannelList
                channels={channels}
                activeChannelId={view?.type === "channel" ? view.channel.id : null}
                onSelectChannel={(ch) => setView({ type: "channel", channel: ch })}
                onlineUsers={onlineUsers}
                voiceChannelId={voice.channelId}
                onJoinVoice={(id) => {
                  const ch = channels.find((c) => c.id === id);
                  if (ch) setView({ type: "channel", channel: ch });
                  voice.joinChannel(id);
                }}
                onLeaveVoice={voice.leave}
                onOpenDMs={() => setView({ type: "dm_list" })}
              />
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-hidden" style={{ background: "#313338" }}>
              {view?.type === "channel" && view.channel.type === "text" && (
                <TextChannel
                  channelName={view.channel.name}
                  messages={messages}
                  isLoading={msgsLoading}
                  currentUserId={user.id}
                  onSend={sendMessage}
                />
              )}

              {view?.type === "channel" && view.channel.type === "voice" && (
                <VoiceVideoChannel
                  channelName={view.channel.name}
                  channelId={view.channel.id}
                  isInChannel={voice.channelId === view.channel.id}
                  peers={voice.peers}
                  isMuted={voice.isMuted}
                  isVideoOn={voice.isVideoOn}
                  onJoin={(withVideo) => voice.joinChannel(view.channel.id, withVideo)}
                  onLeave={voice.leave}
                  onToggleMute={voice.toggleMute}
                  onToggleVideo={voice.toggleVideo}
                />
              )}

              {view?.type === "dm" && (
                <DirectMessage
                  otherUserName={view.otherUserName}
                  otherUserAvatar={view.otherUserAvatar}
                  messages={dmMsgs as DmMessage[]}
                  currentUserId={user.id}
                  onSend={sendDm}
                  onBack={() => setView({ type: "dm_list" })}
                />
              )}

              {(view?.type === "dm_list" || !view) && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-5">
                  <div className="w-12 h-12 rounded-xl bg-lc-input/50 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#949ba4">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                  </div>
                  <p className="text-lc-text-muted text-xs leading-relaxed">
                    Select a channel from the sidebar, or click a user's name to DM them.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {user && (
        <div
          className="flex items-center gap-2.5 px-3 py-2 flex-shrink-0"
          style={{ background: "#232428", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-7 h-7 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-lc-accent/20 border border-lc-accent/30 flex items-center justify-center text-xs font-bold text-lc-accent flex-shrink-0">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-lc-text truncate leading-tight">{user.displayName}</p>
            {voice.isInChannel ? (
              <p className="text-[10px] text-lc-online leading-tight">Voice connected</p>
            ) : (
              <p className="text-[10px] text-lc-text-muted leading-tight">Online</p>
            )}
          </div>
          {voice.isInChannel && (
            <div className="flex gap-1">
              <button
                onClick={voice.toggleMute}
                title={voice.isMuted ? "Unmute" : "Mute"}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  voice.isMuted ? "text-red-400 bg-red-500/10" : "text-lc-text-muted hover:text-lc-text hover:bg-lc-input/60"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  {voice.isMuted
                    ? <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                    : <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  }
                </svg>
              </button>
              <button
                onClick={voice.leave}
                title="Disconnect"
                className="w-7 h-7 rounded flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
