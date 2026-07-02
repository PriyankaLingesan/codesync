/**
 * Domain models shared by the CodeSync server and clients.
 * Pure types only — no runtime logic.
 */

/** A collaboration room. */
export interface Room {
  id: string;
  /** Short, shareable code used to join, e.g. "indigo-otter-42". */
  roomCode: string;
  name: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/** A person who has joined a room (room-code identity, no auth). */
export interface Participant {
  id: string;
  roomId: string;
  displayName: string;
  /** Hex color assigned for cursors and labels, e.g. "#e57373". */
  color: string;
  firstSeenAt: string; // ISO-8601
  lastSeenAt: string; // ISO-8601
}

/** Presence status shown in the online-users panel. */
export type PresenceStatus = "active" | "idle" | "offline";

/**
 * Ephemeral presence for a participant, carried over Yjs awareness.
 * Never persisted.
 */
export interface Presence {
  participantId: string;
  displayName: string;
  color: string;
  status: PresenceStatus;
  /** Workspace-relative path of the file the user is currently viewing. */
  activeFile: string | null;
  /** Whether the user is actively typing (drives typing indicators). */
  typing: boolean;
  /** Cursor + selection in the active file. Null when no editor is focused. */
  cursor: CursorState | null;
}

/** A cursor position and optional selection range within a single document. */
export interface CursorState {
  /** Workspace-relative file path this cursor belongs to. */
  file: string;
  anchor: DocPosition;
  head: DocPosition;
}

/** A zero-based line/character position. */
export interface DocPosition {
  line: number;
  character: number;
}

/** A persisted workspace chat message. */
export interface ChatMessage {
  id: string;
  roomId: string;
  participantId: string | null;
  authorName: string;
  body: string;
  createdAt: string; // ISO-8601
}

/** Kinds of activity recorded in the feed/timeline. */
export type ActivityType = "join" | "leave" | "file_open" | "edit" | "chat";

/** A single entry in the activity feed / collaboration timeline. */
export interface ActivityEvent {
  id: string;
  roomId: string;
  participantId: string | null;
  actorName: string;
  type: ActivityType;
  /** Type-specific detail, e.g. { file: "src/app.ts" }. */
  payload: Record<string, unknown>;
  createdAt: string; // ISO-8601
}
