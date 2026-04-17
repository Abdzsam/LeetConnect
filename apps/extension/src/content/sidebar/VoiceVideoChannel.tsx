interface VoiceVideoChannelProps {
  channelName: string;
  channelId: string;
  isInChannel: boolean;
  peers: string[];
  isMuted: boolean;
  isVideoOn: boolean;
  onJoin: (withVideo: boolean) => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export function VoiceVideoChannel({
  channelName,
  channelId: _channelId,
  isInChannel,
  peers,
  isMuted,
  isVideoOn,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleVideo,
}: VoiceVideoChannelProps) {
  const totalInChannel = isInChannel ? peers.length + 1 : 0;

  return (
    <div className="flex flex-col h-full bg-lc-channel">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-lc-text-muted flex-shrink-0">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <span className="text-lc-text font-semibold text-sm">{channelName}</span>
        {isInChannel && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-lc-online font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-lc-online animate-pulse" />
            {totalInChannel} connected
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isInChannel ? (
          /* Not joined */
          <div className="flex flex-col items-center justify-center h-full gap-5 px-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-lc-online/10 border border-lc-online/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#23a55a">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </div>
            <div>
              <p className="text-lc-text font-semibold text-sm mb-1">Join {channelName}</p>
              <p className="text-lc-text-muted text-xs leading-relaxed">
                Talk through the problem with others in real time.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => onJoin(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-lc-online hover:bg-lc-online/80 text-white font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
                Voice
              </button>
              <button
                onClick={() => onJoin(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-lc-input hover:bg-lc-input/80 text-lc-text font-semibold px-3 py-2 rounded-lg text-sm transition-colors border border-white/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                + Video
              </button>
            </div>
          </div>
        ) : (
          /* Joined */
          <div className="flex flex-col h-full">
            {/* Video grid */}
            <div className="flex-1 p-3">
              {peers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-lc-online/10 border border-lc-online/20 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#23a55a">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                  </div>
                  <p className="text-lc-text-muted text-xs">You're connected. Waiting for others to join...</p>
                </div>
              ) : (
                <div id="lc-video-grid" className="grid grid-cols-2 gap-2 h-full" />
              )}
            </div>

            {/* Controls bar */}
            <div className="flex items-center justify-center gap-2 px-3 pb-4">
              <button
                onClick={onToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? "bg-red-500/20 border border-red-500/50 text-red-400" : "bg-lc-input hover:bg-lc-input/80 text-lc-text"
                }`}
              >
                {isMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                )}
              </button>

              <button
                onClick={onToggleVideo}
                title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  !isVideoOn ? "bg-red-500/20 border border-red-500/50 text-red-400" : "bg-lc-input hover:bg-lc-input/80 text-lc-text"
                }`}
              >
                {isVideoOn ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6.5l-4-4-14 14 4 4 14-14zm-17.5.27L7 10.27V7h3.27L10 6.73 3.5 6.77zM13 10h-3v3l3.27-.27L13 10z"/>
                  </svg>
                )}
              </button>

              <button
                onClick={onLeave}
                title="Leave channel"
                className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
