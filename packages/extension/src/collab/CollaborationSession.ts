import * as vscode from "vscode";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate
} from "y-protocols/awareness";
import {
  ClientEvent,
  type ActivityEvent,
  type ChatMessage,
  type Participant,
  type Presence,
  type TypingIndicator
} from "@codesync/shared";
import type { ExtensionConfig } from "../config";
import { ConnectionManager, type ConnectionStatus } from "../net/ConnectionManager";
import { DocumentBinding } from "./DocumentBinding";
import { CursorTracker } from "./CursorTracker";
import { RemoteCursorRenderer } from "./RemoteCursorRenderer";
import { fileKeyFor, relativePath } from "../util/uri";
import { fromBase64, toBase64 } from "../util/encoding";

const REMOTE_ORIGIN = "remote";

/** Events the session raises back to the controller / UI. */
export interface SessionCallbacks {
  onPresence(presence: Presence[]): void;
  onStatus(status: ConnectionStatus): void;
  onActivity(event: ActivityEvent): void;
  onChat(message: ChatMessage): void;
  onChatTyping(indicator: TypingIndicator, typing: boolean): void;
  onSelf(participantId: string): void;
}

/**
 * Client-side collaboration state for one room: owns the Yjs document and
 * awareness, wires them to the WebSocket, binds open editors, renders live
 * cursors, and relays chat. State is surfaced through the callbacks.
 */
export class CollaborationSession {
  private readonly doc = new Y.Doc();
  private readonly awareness = new Awareness(this.doc);
  private readonly connection: ConnectionManager;
  private readonly bindings = new Map<string, DocumentBinding>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly cursorTracker: CursorTracker;
  private readonly renderer: RemoteCursorRenderer;
  private participant: Participant | null = null;

  constructor(
    config: ExtensionConfig,
    readonly roomCode: string,
    readonly roomName: string,
    private readonly callbacks: SessionCallbacks
  ) {
    this.cursorTracker = new CursorTracker(this.awareness);
    this.renderer = new RemoteCursorRenderer(this.awareness, this.doc.clientID);

    this.connection = new ConnectionManager(
      config.serverUrlWs,
      roomCode,
      config.displayName,
      {
        onWelcome: (payload) => {
          this.participant = payload.participant;
          Y.applyUpdate(this.doc, fromBase64(payload.initialState), REMOTE_ORIGIN);
          this.publishInitialPresence();
          this.cursorTracker.publishCurrent();
          this.callbacks.onSelf(payload.participant.id);
          this.callbacks.onPresence(payload.presence);
        },
        onSyncUpdate: (payload) => {
          Y.applyUpdate(this.doc, fromBase64(payload.update), REMOTE_ORIGIN);
        },
        onAwarenessUpdate: (payload) => {
          applyAwarenessUpdate(
            this.awareness,
            fromBase64(payload.update),
            REMOTE_ORIGIN
          );
        },
        onPresenceList: (payload) => this.callbacks.onPresence(payload.presence),
        onActivity: (payload) => this.callbacks.onActivity(payload.event),
        onChatMessage: (payload) => this.callbacks.onChat(payload.message),
        onChatTyping: (payload) =>
          this.callbacks.onChatTyping(
            { participantId: payload.participantId, displayName: payload.displayName },
            payload.typing
          ),
        onError: (payload) =>
          void vscode.window.showErrorMessage(`CodeSync: ${payload.message}`),
        onStatusChange: (status) => this.callbacks.onStatus(status)
      }
    );

    // Local document edits -> server (skip updates we applied from remote).
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      this.connection.send({
        type: ClientEvent.SYNC_UPDATE,
        payload: { update: toBase64(update) }
      });
    });

    // Local presence changes -> server.
    this.awareness.on("update", (_changes: unknown, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
      this.connection.send({
        type: ClientEvent.AWARENESS_UPDATE,
        payload: { update: toBase64(update) }
      });
    });

    // Follow the active editor for binding + active-file presence.
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.bindEditor(editor);
        this.updateActiveFile();
      })
    );
  }

  connect(): void {
    this.connection.connect();
    const editor = vscode.window.activeTextEditor;
    if (editor) this.bindEditor(editor);
  }

  /** Send a chat message to the room. */
  sendChat(body: string): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    this.connection.send({
      type: ClientEvent.CHAT_SEND,
      payload: { body: trimmed }
    });
  }

  /** Notify the room that this user is (or stopped) typing in chat. */
  sendChatTyping(typing: boolean): void {
    this.connection.send({
      type: ClientEvent.CHAT_TYPING,
      payload: { typing }
    });
  }

  private publishInitialPresence(): void {
    if (!this.participant) return;
    const presence: Presence = {
      participantId: this.participant.id,
      displayName: this.participant.displayName,
      color: this.participant.color,
      status: "active",
      activeFile: this.currentFileKey(),
      typing: false,
      cursor: null
    };
    this.awareness.setLocalState(presence);
  }

  private bindEditor(editor: vscode.TextEditor): void {
    const key = fileKeyFor(editor.document);
    if (!key || this.bindings.has(key)) return;
    this.bindings.set(key, new DocumentBinding(this.doc, editor.document, key));
  }

  private updateActiveFile(): void {
    const state = this.awareness.getLocalState();
    if (!state) return;
    this.awareness.setLocalState({ ...state, activeFile: this.currentFileKey() });
  }

  private currentFileKey(): string | null {
    const editor = vscode.window.activeTextEditor;
    return editor ? relativePath(editor.document) : null;
  }

  dispose(): void {
    this.connection.disconnect();
    this.cursorTracker.dispose();
    this.renderer.dispose();
    for (const binding of this.bindings.values()) binding.dispose();
    for (const d of this.disposables) d.dispose();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
