import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import type { Message } from "@leetconnect/types";

interface TextChannelProps {
  channelName: string;
  messages: Message[];
  isLoading: boolean;
  currentUserId: string;
  onSend: (content: string) => void;
}

export function TextChannel({
  channelName,
  messages,
  isLoading,
  currentUserId,
  onSend,
}: TextChannelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  }

  function submitMessage() {
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // Group consecutive messages from the same sender
  const grouped = messages.reduce<{ msg: Message; showHeader: boolean }[]>((acc, msg, i) => {
    const prev = messages[i - 1];
    const sameAuthor = prev?.sender.id === msg.sender.id;
    const closeInTime = prev
      ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
      : false;
    acc.push({ msg, showHeader: !sameAuthor || !closeInTime });
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full bg-lc-channel">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 bg-lc-channel">
        <span className="text-lc-text-muted text-base font-light">#</span>
        <span className="text-lc-text font-semibold text-sm">{channelName}</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#383a40 transparent" }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-2 text-lc-text-muted text-xs">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-lc-accent/10 border border-lc-accent/20 flex items-center justify-center">
              <span className="text-xl">#</span>
            </div>
            <div>
              <p className="text-lc-text font-semibold text-sm">Welcome to #{channelName}</p>
              <p className="text-lc-text-muted text-xs mt-1">Start the conversation — be the first to say something!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {grouped.map(({ msg, showHeader }) => {
              const isMine = msg.sender.id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`group flex gap-2.5 px-2 py-0.5 rounded-md hover:bg-white/[0.03] transition-colors ${
                    showHeader ? "mt-3" : "mt-0"
                  }`}
                >
                  {/* Avatar or spacer */}
                  {showHeader ? (
                    <div className="flex-shrink-0 mt-0.5">
                      {msg.sender.avatarUrl ? (
                        <img
                          src={msg.sender.avatarUrl}
                          alt={msg.sender.displayName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-lc-accent/20 border border-lc-accent/30 flex items-center justify-center text-xs font-bold text-lc-accent">
                          {msg.sender.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className={`text-[13px] font-semibold leading-none ${isMine ? "text-lc-accent" : "text-lc-text"}`}>
                          {msg.sender.displayName}
                        </span>
                        <span className="text-[10px] text-lc-text-muted leading-none">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                    {msg.deletedAt ? (
                      <p className="text-xs text-lc-text-muted italic">Message deleted</p>
                    ) : (
                      <p className="text-[13px] text-lc-text leading-relaxed break-words whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-end gap-2 bg-lc-input rounded-lg px-3 py-2 border border-white/5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-lc-text placeholder-lc-text-muted/60 resize-none outline-none min-h-[20px] max-h-[100px] leading-5"
            style={{ height: "20px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "20px";
              el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
            }}
          />
          <button
            onClick={submitMessage}
            disabled={!draft.trim()}
            className="text-lc-accent disabled:text-lc-text-muted/40 hover:text-lc-accent-hover transition-colors flex-shrink-0 pb-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-lc-text-muted/50 mt-1 px-1">
          Enter ↵ to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
