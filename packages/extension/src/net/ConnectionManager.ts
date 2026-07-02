import WebSocket from "ws";
import {
  ClientEvent,
  ServerEvent,
  type ClientMessage,
  type ServerMessage
} from "@codesync/shared";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

type PayloadOf<T extends ServerMessage["type"]> = Extract<
  ServerMessage,
  { type: T }
>["payload"];

/** Callbacks the session provides to react to server messages + status. */
export interface ConnectionHandlers {
  onWelcome(payload: PayloadOf<typeof ServerEvent.WELCOME>): void;
  onSyncUpdate(payload: PayloadOf<typeof ServerEvent.SYNC_UPDATE>): void;
  onAwarenessUpdate(payload: PayloadOf<typeof ServerEvent.AWARENESS_UPDATE>): void;
  onPresenceList(payload: PayloadOf<typeof ServerEvent.PRESENCE_LIST>): void;
  onActivity(payload: PayloadOf<typeof ServerEvent.ACTIVITY>): void;
  onChatMessage(payload: PayloadOf<typeof ServerEvent.CHAT_MESSAGE>): void;
  onChatTyping(payload: PayloadOf<typeof ServerEvent.CHAT_TYPING>): void;
  onError(payload: PayloadOf<typeof ServerEvent.ERROR>): void;
  onStatusChange(status: ConnectionStatus): void;
}

const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

/**
 * Manages a single room WebSocket: opening it, the JOIN handshake, typed
 * message dispatch, keep-alive pings, and reconnect with exponential backoff.
 */
export class ConnectionManager {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private reconnectAttempts = 0;
  private pingTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly wsBaseUrl: string,
    private readonly roomCode: string,
    private readonly displayName: string,
    private readonly handlers: ConnectionHandlers
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.handlers.onStatusChange("connecting");

    const url = `${this.wsBaseUrl}/rooms/${encodeURIComponent(this.roomCode)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.handlers.onStatusChange("connected");
      this.send({
        type: ClientEvent.JOIN,
        payload: { roomCode: this.roomCode, displayName: this.displayName }
      });
      this.startPing();
    });

    ws.on("message", (raw: WebSocket.RawData) => this.dispatch(raw.toString()));

    ws.on("close", () => {
      this.stopPing();
      this.handlers.onStatusChange("disconnected");
      if (!this.closedByUser) this.scheduleReconnect();
    });

    ws.on("error", () => undefined);
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.closedByUser = true;
    this.stopPing();
    this.ws?.close();
    this.ws = null;
  }

  private dispatch(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    switch (message.type) {
      case ServerEvent.WELCOME:
        this.handlers.onWelcome(message.payload);
        return;
      case ServerEvent.SYNC_UPDATE:
        this.handlers.onSyncUpdate(message.payload);
        return;
      case ServerEvent.AWARENESS_UPDATE:
        this.handlers.onAwarenessUpdate(message.payload);
        return;
      case ServerEvent.PRESENCE_LIST:
        this.handlers.onPresenceList(message.payload);
        return;
      case ServerEvent.ACTIVITY:
        this.handlers.onActivity(message.payload);
        return;
      case ServerEvent.CHAT_MESSAGE:
        this.handlers.onChatMessage(message.payload);
        return;
      case ServerEvent.CHAT_TYPING:
        this.handlers.onChatTyping(message.payload);
        return;
      case ServerEvent.ERROR:
        this.handlers.onError(message.payload);
        return;
      case ServerEvent.PONG:
        // Keep-alive; no-op.
        return;
      default: {
        const exhaustive: never = message;
        void exhaustive;
        return;
      }
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: ClientEvent.PING, payload: {} });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    setTimeout(() => {
      if (!this.closedByUser) this.connect();
    }, delay);
  }
}
