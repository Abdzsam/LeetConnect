import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { DmMessage } from "@leetconnect/types";

interface DirectMessageProps {
  otherUserName: string;
  otherUserAvatar: string | null;
  messages: DmMessage[];
  currentUserId: string;
  onSend: (content: string) => void;
  onBack: () => void;
}

export function DirectMessage({
  otherUserName,
  otherUserAvatar,
  messages,
  currentUserId,
  onSend,
  onBack,
}: DirectMessageProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full bg-lc-channel">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/5">
        <button
          onClick={onBack}
          className="text-lc-text-muted hover:text-lc-text transition-colors p-0.5 rounded"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        {otherUserAvatar ? (
          <img src={otherUserAvatar} alt={otherUserName} className="w-6 h-6 rounded-full" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-lc-accent/20 border border-lc-accent/30 flex items-center justify-center text-[10px] font-bold text-lc-accent">
            {otherUserName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-lc-text font-semibold text-sm">{otherUserName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5" style={{ scrollbarWidth: "thin", scrollbarColor: "#383a40 transparent" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-lc-text-muted text-xs">Start a conversation with {otherUserName}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender.id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-[13px] break-words leading-relaxed ${
                  isMine
                    ? "bg-lc-accent text-black rounded-br-md"
                    : "bg-lc-input text-lc-text rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-end gap-2 bg-lc-input rounded-lg px-3 py-2 border border-white/5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUserName}...`}
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
            onClick={submit}
            disabled={!draft.trim()}
            className="text-lc-accent disabled:text-lc-text-muted/40 hover:text-lc-accent-hover transition-colors flex-shrink-0 pb-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
