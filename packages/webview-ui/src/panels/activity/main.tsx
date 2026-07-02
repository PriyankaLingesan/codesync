import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ActivityEvent } from "@codesync/shared";
import { getVsCodeApi, onHostMessage } from "../../lib/vscode";
import { relativeTime } from "../../lib/format";
import { baseStyles } from "../../lib/styles";

const ICONS: Record<string, string> = {
  join: "→",
  leave: "←",
  file_open: "📄",
  edit: "✎",
  chat: "💬"
};

function describe(event: ActivityEvent): { verb: string; file: string | null } {
  const file =
    typeof event.payload.file === "string" ? event.payload.file : null;
  switch (event.type) {
    case "join":
      return { verb: "joined the room", file: null };
    case "leave":
      return { verb: "left the room", file: null };
    case "file_open":
      return { verb: "opened", file };
    case "edit":
      return { verb: file ? "edited" : "made an edit", file };
    case "chat":
      return { verb: "sent a message", file: null };
    default:
      return { verb: event.type, file };
  }
}

function ActivityApp(): React.JSX.Element {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const off = onHostMessage((message) => {
      if (message.type === "activity") setEvents(message.events);
    });
    getVsCodeApi().postMessage({ type: "ready" });
    return off;
  }, []);

  return (
    <>
      <style>{baseStyles}</style>
      {events.length === 0 ? (
        <div className="empty">No activity yet.</div>
      ) : (
        <ul className="feed">
          {events.map((event) => {
            const { verb, file } = describe(event);
            return (
              <li className="event" key={event.id}>
                <span className="icon">{ICONS[event.type] ?? "•"}</span>
                <span className="text">
                  <span className="actor">{event.actorName}</span> {verb}
                  {file ? <span className="file"> {file}</span> : null}
                </span>
                <span className="time">{relativeTime(event.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<ActivityApp />);
