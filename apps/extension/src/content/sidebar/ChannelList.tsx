import type { Channel, OnlineUser } from "@leetconnect/types";

interface ChannelListProps {
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onlineUsers: OnlineUser[];
  voiceChannelId: string | null;
  onJoinVoice: (channelId: string) => void;
  onLeaveVoice: () => void;
  onOpenDMs: () => void;
}

export function ChannelList({
  channels,
  activeChannelId,
  onSelectChannel,
  onlineUsers,
  voiceChannelId,
  onJoinVoice,
  onLeaveVoice,
  onOpenDMs,
}: ChannelListProps) {
  const textChannels = channels.filter((c) => c.type === "text");
  const voiceChannels = channels.filter((c) => c.type === "voice");

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>

      {/* Text Channels */}
      <div className="pt-4 pb-1">
        <p className="text-[11px] font-semibold text-lc-text-muted uppercase tracking-wider px-3 mb-1 flex items-center justify-between">
          <span>Text</span>
        </p>
        {textChannels.map((ch) => {
          const isActive = activeChannelId === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md text-sm transition-all duration-100 ${
                isActive
                  ? "bg-lc-input text-lc-text font-medium"
                  : "text-lc-text-muted hover:text-lc-text hover:bg-lc-input/60"
              }`}
              style={{ width: "calc(100% - 8px)" }}
            >
              <span className={`text-base leading-none flex-shrink-0 ${isActive ? "text-lc-text" : "text-lc-text-muted"}`}>#</span>
              <span className="truncate text-[13px]">{ch.name}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-white/5" />

      {/* Voice Channels */}
      <div className="pb-1">
        <p className="text-[11px] font-semibold text-lc-text-muted uppercase tracking-wider px-3 mb-1">
          Voice
        </p>
        {voiceChannels.map((ch) => {
          const isActive = voiceChannelId === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => isActive ? onLeaveVoice() : onJoinVoice(ch.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md text-sm transition-all duration-100 ${
                isActive
                  ? "bg-lc-online/15 text-lc-online font-medium"
                  : "text-lc-text-muted hover:text-lc-text hover:bg-lc-input/60"
              }`}
              style={{ width: "calc(100% - 8px)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
              <span className="truncate text-[13px]">{ch.name}</span>
              {isActive && (
                <span className="ml-auto flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-lc-online animate-pulse" />
                  live
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-white/5" />

      {/* Online Users */}
      <div className="pb-1 flex-1">
        <p className="text-[11px] font-semibold text-lc-text-muted uppercase tracking-wider px-3 mb-1">
          Online — {onlineUsers.length}
        </p>
        {onlineUsers.length === 0 ? (
          <p className="text-[11px] text-lc-text-muted px-3 italic">Just you so far</p>
        ) : (
          onlineUsers.map((u) => (
            <div
              key={u.userId}
              className="flex items-center gap-2 px-2 py-1 mx-1 rounded-md hover:bg-lc-input/60 cursor-pointer transition-colors"
              style={{ width: "calc(100% - 8px)" }}
            >
              <div className="relative flex-shrink-0">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt={u.displayName} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-lc-accent/20 border border-lc-accent/30 flex items-center justify-center text-[10px] font-bold text-lc-accent">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-lc-online border-2 border-lc-sidebar" />
              </div>
              <span className="text-[13px] text-lc-text truncate">{u.displayName}</span>
            </div>
          ))
        )}
      </div>

      {/* DMs button at bottom */}
      <div className="px-2 pb-3 pt-2 border-t border-white/5">
        <button
          onClick={onOpenDMs}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-lc-text-muted hover:text-lc-text hover:bg-lc-input/60 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          <span className="text-[13px]">Direct Messages</span>
        </button>
      </div>
    </div>
  );
}
