/**
 * CodeSync WebSocket message protocol.
 *
 * Every WS frame is a JSON object with a `type` discriminator (see events.ts)
 * and a `payload`. Binary Yjs updates (sync + awareness) are base64-encoded so
 * everything travels as a single JSON text frame.
 *
 * The `ClientMessage` and `ServerMessage` discriminated unions let TypeScript
 * exhaustively narrow every message on both ends.
 */

import { ClientEvent, ServerEvent } from "./events.js";
import type {
  ActivityEvent,
  ChatMessage,
  Participant,
  Presence
} from "./models.js";

/** Base64-encoded binary Yjs payload (update or awareness). */
export type Base64 = string;

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export interface JoinMessage {
  type: typeof ClientEvent.JOIN;
  payload: {
    roomCode: string;
    displayName: string;
  };
}

export interface ClientSyncUpdateMessage {
  type: typeof ClientEvent.SYNC_UPDATE;
  payload: {
    /** Y.encodeStateAsUpdate / update from the observer, base64-encoded. */
    update: Base64;
  };
}

export interface ClientAwarenessUpdateMessage {
  type: typeof ClientEvent.AWARENESS_UPDATE;
  payload: {
    /** encodeAwarenessUpdate output, base64-encoded. */
    update: Base64;
  };
}

export interface ChatSendMessage {
  type: typeof ClientEvent.CHAT_SEND;
  payload: {
    body: string;
  };
}

export interface ClientChatTypingMessage {
  type: typeof ClientEvent.CHAT_TYPING;
  payload: {
    typing: boolean;
  };
}

export interface PingMessage {
  type: typeof ClientEvent.PING;
  payload: Record<string, never>;
}

export type ClientMessage =
  | JoinMessage
  | ClientSyncUpdateMessage
  | ClientAwarenessUpdateMessage
  | ChatSendMessage
  | ClientChatTypingMessage
  | PingMessage;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface WelcomeMessage {
  type: typeof ServerEvent.WELCOME;
  payload: {
    /** The participant record the server created/assigned for this client. */
    participant: Participant;
    /** Full current document state to bootstrap the client's Y.Doc. */
    initialState: Base64;
    /** Everyone currently present (including this participant). */
    presence: Presence[];
  };
}

export interface ServerSyncUpdateMessage {
  type: typeof ServerEvent.SYNC_UPDATE;
  payload: {
    update: Base64;
    /** Participant whose edit produced this update (for attribution). */
    from: string;
  };
}

export interface ServerAwarenessUpdateMessage {
  type: typeof ServerEvent.AWARENESS_UPDATE;
  payload: {
    update: Base64;
  };
}

export interface PresenceListMessage {
  type: typeof ServerEvent.PRESENCE_LIST;
  payload: {
    presence: Presence[];
  };
}

export interface ChatMessageEvent {
  type: typeof ServerEvent.CHAT_MESSAGE;
  payload: {
    message: ChatMessage;
  };
}

export interface ServerChatTypingMessage {
  type: typeof ServerEvent.CHAT_TYPING;
  payload: {
    participantId: string;
    displayName: string;
    typing: boolean;
  };
}

export interface ActivityMessage {
  type: typeof ServerEvent.ACTIVITY;
  payload: {
    event: ActivityEvent;
  };
}

export interface PongMessage {
  type: typeof ServerEvent.PONG;
  payload: Record<string, never>;
}

export interface ErrorMessage {
  type: typeof ServerEvent.ERROR;
  payload: {
    code: string;
    message: string;
  };
}

export type ServerMessage =
  | WelcomeMessage
  | ServerSyncUpdateMessage
  | ServerAwarenessUpdateMessage
  | PresenceListMessage
  | ChatMessageEvent
  | ServerChatTypingMessage
  | ActivityMessage
  | PongMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// REST DTOs (room lifecycle + history) — used alongside the WS channel.
// ---------------------------------------------------------------------------

/** POST /rooms */
export interface CreateRoomRequest {
  name: string;
}
export interface CreateRoomResponse {
  roomId: string;
  roomCode: string;
  name: string;
}

/** POST /rooms/:roomCode/join (validates a code before opening the WS). */
export interface JoinRoomRequest {
  displayName: string;
}
export interface JoinRoomResponse {
  roomId: string;
  roomCode: string;
  name: string;
}
