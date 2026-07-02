import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ChatMessage, TypingIndicator } from "@codesync/shared";
import { getVsCodeApi, onHostMessage } from "../../lib/vscode";
import { relativeTime } from "../../lib/format";
import { baseStyles } from "../../lib/styles";

const TYPING_SEND_THROTTLE_MS = 1500;
const TYPING_STOP_IDLE_MS = 2000;

function typingLabel(typing: TypingIndicator[], selfId: string | null): string {
  const others = typing.filter((t) => t.participantId !== selfId);
  if (others.length === 0) return "";
  if (others.length === 1) return `${others[0].displayName} is typing…`;
  if (others.length === 2)
    return `${others[0].displayName} and ${others[1].displayName} are typing…`;
  return "Several people are typing…";
}

function ChatApp(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState<TypingIndicator[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const api = useMemo(() => getVsCodeApi(), []);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSent = useRef(0);
  const stopTypingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const off = onHostMessage((message) => {
      if (message.type === "chat") setMessages(message.messages);
      else if (message.type === "chat:typing") setTyping(message.typing);
      else if (message.type === "session") setSelfId(message.selfId);
    });
    api.postMessage({ type: "ready" });
    return off;
  }, [api]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing]);

  const signalTyping = (): void => {
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_SEND_THROTTLE_MS) {
      lastTypingSent.current = now;
      api.postMessage({ type: "chat:typing", typing: true });
    }
    window.clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = window.setTimeout(() => {
      lastTypingSent.current = 0;
      api.postMessage({ type: "chat:typing", typing: false });
    }, TYPING_STOP_IDLE_MS);
  };

  const submit = (): void => {
    const body = draft.trim();
    if (!body) return;
    api.postMessage({ type: "chat:send", body });
    api.postMessage({ type: "chat:typing", typing: false });
    window.clearTimeout(stopTypingTimer.current);
    lastTypingSent.current = 0;
    setDraft("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const label = typingLabel(typing, selfId);

  return (
    <>
      <style>{baseStyles}</style>
      <div className="chat">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">No messages yet. Say hello!</div>
          ) : (
            messages.map((m) => (
              <div className="msg" key={m.id}>
                <div className="body">
                  <div className="head">
                    <span
                      className={
                        m.participantId === selfId ? "author self" : "author"
                      }
                    >
                      {m.authorName}
                      {m.participantId === selfId ? " (you)" : ""}
                    </span>
                    <span className="time">{relativeTime(m.createdAt)}</span>
                  </div>
                  <div className="content">{m.body}</div>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <div className="typing">{label}</div>
        <div className="composer">
          <textarea
            rows={2}
            placeholder="Message the room…  (Enter to send, Shift+Enter for newline)"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              signalTyping();
            }}
            onKeyDown={onKeyDown}
          />
          <button onClick={submit} disabled={draft.trim().length === 0}>
            Send
          </button>
        </div>
      </div>
    </>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<ChatApp />);
