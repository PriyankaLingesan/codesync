import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Presence } from "@codesync/shared";
import { getVsCodeApi, onHostMessage } from "../../lib/vscode";
import { initials } from "../../lib/format";
import { baseStyles } from "../../lib/styles";

function subtitle(p: Presence): string {
  if (p.typing) return "typing…";
  if (p.activeFile) return p.activeFile;
  return "idle";
}

function PresenceApp(): React.JSX.Element {
  const [presence, setPresence] = useState<Presence[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    const off = onHostMessage((message) => {
      if (message.type === "presence") setPresence(message.presence);
      else if (message.type === "session") setSelfId(message.selfId);
    });
    getVsCodeApi().postMessage({ type: "ready" });
    return off;
  }, []);

  return (
    <>
      <style>{baseStyles}</style>
      {presence.length === 0 ? (
        <div className="empty">No collaborators online.</div>
      ) : (
        <ul className="list">
          {presence.map((p) => (
            <li className="row" key={p.participantId}>
              <span className="avatar" style={{ background: p.color }}>
                {initials(p.displayName)}
              </span>
              <span className="meta">
                <span className="name">
                  {p.displayName}
                  {p.participantId === selfId ? " (you)" : ""}
                </span>
                <span className="sub">{subtitle(p)}</span>
              </span>
              <span
                className="dot"
                title={p.typing ? "typing" : p.status}
                style={{ background: p.typing ? "#4caf50" : p.color }}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<PresenceApp />);
