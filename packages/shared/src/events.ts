/**
 * Canonical event-name constants for the CodeSync WebSocket protocol.
 * Using string-literal unions keeps the wire format explicit and type-safe on
 * both ends. Grouped by direction for readability.
 */

/** Messages a client sends to the server. */
export const ClientEvent = {
  /** Handshake after connecting: identify the joining participant. */
  JOIN: "client:join",
  /** Incremental Yjs document update (binary, base64-encoded on the wire). */
  SYNC_UPDATE: "client:sync_update",
  /** Yjs awareness update (presence: cursor, selection, active file, typing). */
  AWARENESS_UPDATE: "client:awareness_update",
  /** Send a chat message. */
  CHAT_SEND: "client:chat_send",
  /** Notify others that this client is (or stopped) typing in chat. */
  CHAT_TYPING: "client:chat_typing",
  /** Keep-alive ping. */
  PING: "client:ping"
} as const;
export type ClientEvent = (typeof ClientEvent)[keyof typeof ClientEvent];

/** Messages the server sends to clients. */
export const ServerEvent = {
  /** Sent once after JOIN: assigned participant + initial document state. */
  WELCOME: "server:welcome",
  /** Relayed Yjs document update from a peer (binary, base64 on the wire). */
  SYNC_UPDATE: "server:sync_update",
  /** Relayed awareness/presence update. */
  AWARENESS_UPDATE: "server:awareness_update",
  /** Roster change: someone joined or left. */
  PRESENCE_LIST: "server:presence_list",
  /** A new chat message. */
  CHAT_MESSAGE: "server:chat_message",
  /** Relayed chat typing indicator. */
  CHAT_TYPING: "server:chat_typing",
  /** A new activity-feed entry. */
  ACTIVITY: "server:activity",
  /** Keep-alive pong. */
  PONG: "server:pong",
  /** Recoverable error notification. */
  ERROR: "server:error"
} as const;
export type ServerEvent = (typeof ServerEvent)[keyof typeof ServerEvent];
