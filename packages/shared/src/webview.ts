/**
 * Messages exchanged between the VS Code extension host and its React webview
 * panels (presence, activity, chat, graph). Shared so both sides stay type-safe.
 */
import type { ActivityEvent, ChatMessage, Presence } from "./models.js";

/** A collaborator currently typing in chat. */
export interface TypingIndicator {
  participantId: string;
  displayName: string;
}

/** A node in the codebase dependency/import graph. */
export interface GraphNode {
  /** Workspace-relative path for files; "npm:<pkg>" for external packages. */
  id: string;
  label: string;
  kind: "file" | "external";
  /** Total connected edges (drives node size). */
  degree: number;
}

/** A directed import edge: `source` imports `target`. */
export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Extension host -> webview. */
export type HostToWebview =
  | { type: "session"; roomCode: string | null; selfId: string | null }
  | { type: "presence"; presence: Presence[] }
  | { type: "activity"; events: ActivityEvent[] }
  | { type: "chat"; messages: ChatMessage[] }
  | { type: "chat:typing"; typing: TypingIndicator[] }
  | { type: "graph"; graph: GraphData };

/** Webview -> extension host. */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "chat:send"; body: string }
  | { type: "chat:typing"; typing: boolean }
  | { type: "refresh" }
  | { type: "open-file"; path: string };
