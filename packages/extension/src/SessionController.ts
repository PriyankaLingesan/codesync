import * as vscode from "vscode";
import type {
  ActivityEvent,
  ChatMessage,
  Presence,
  TypingIndicator
} from "@codesync/shared";
import { readConfig, type ExtensionConfig } from "./config";
import { HttpClient } from "./net/httpClient";
import type { ConnectionStatus } from "./net/ConnectionManager";
import { CollaborationSession } from "./collab/CollaborationSession";
import type { CollaborationView } from "./webview/CollaborationView";
import type { ChatBridge } from "./webview/ChatViewProvider";

const MAX_ACTIVITY = 200;
const MAX_CHAT = 200;
const TYPING_EXPIRY_MS = 4000;

/**
 * Owns the single active collaboration session, the status-bar UI, and the
 * data the webview panels render from (presence, activity, chat). Serves as
 * both the read-only CollaborationView and the ChatBridge for outbound actions.
 */
export class SessionController implements CollaborationView, ChatBridge {
  private session: CollaborationSession | null = null;
  private readonly statusBar: vscode.StatusBarItem;

  private presence: Presence[] = [];
  private activity: ActivityEvent[] = [];
  private chat: ChatMessage[] = [];
  private readonly typing = new Map<
    string,
    { displayName: string; timer: NodeJS.Timeout }
  >();
  private selfId: string | null = null;
  private roomCode: string | null = null;

  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBar.command = "codesync.leaveRoom";
    context.subscriptions.push(this.statusBar, this.changeEmitter);
  }

  // --- CollaborationView ---
  getRoomCode(): string | null {
    return this.roomCode;
  }
  getSelfId(): string | null {
    return this.selfId;
  }
  getPresence(): Presence[] {
    return this.presence;
  }
  getActivity(): ActivityEvent[] {
    return this.activity;
  }
  getChat(): ChatMessage[] {
    return this.chat;
  }
  getChatTyping(): TypingIndicator[] {
    return [...this.typing.entries()].map(([participantId, v]) => ({
      participantId,
      displayName: v.displayName
    }));
  }

  // --- ChatBridge ---
  sendChat(body: string): void {
    this.session?.sendChat(body);
  }
  sendChatTyping(typing: boolean): void {
    this.session?.sendChatTyping(typing);
  }

  // --- Commands ---
  async createRoom(): Promise<void> {
    const config = readConfig();
    const name = await vscode.window.showInputBox({
      prompt: "Name your CodeSync room",
      value: "My Room"
    });
    if (name === undefined) return;

    try {
      const http = new HttpClient(config.serverUrlHttp);
      const room = await http.createRoom(name.trim() || "Untitled Room");
      this.startSession(config, room.roomCode, room.name);
      await vscode.env.clipboard.writeText(room.roomCode);
      void vscode.window.showInformationMessage(
        `CodeSync room created: ${room.roomCode} (copied to clipboard). Share it to collaborate.`
      );
    } catch (error) {
      void vscode.window.showErrorMessage(`CodeSync: ${asMessage(error)}`);
    }
  }

  async joinRoom(): Promise<void> {
    const config = readConfig();
    const roomCode = await vscode.window.showInputBox({
      prompt: "Enter the CodeSync room code",
      placeHolder: "indigo-otter-42"
    });
    if (!roomCode) return;

    try {
      const http = new HttpClient(config.serverUrlHttp);
      const room = await http.joinRoom(roomCode.trim(), config.displayName);
      this.startSession(config, room.roomCode, room.name);
      void vscode.window.showInformationMessage(
        `CodeSync: joined "${room.name}" (${room.roomCode}).`
      );
    } catch (error) {
      void vscode.window.showErrorMessage(`CodeSync: ${asMessage(error)}`);
    }
  }

  leave(): void {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    for (const { timer } of this.typing.values()) clearTimeout(timer);
    this.typing.clear();
    this.presence = [];
    this.activity = [];
    this.chat = [];
    this.selfId = null;
    this.roomCode = null;
    this.statusBar.hide();
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.leave();
  }

  private startSession(
    config: ExtensionConfig,
    roomCode: string,
    roomName: string
  ): void {
    this.leave();
    this.roomCode = roomCode;
    this.session = new CollaborationSession(config, roomCode, roomName, {
      onPresence: (presence) => {
        this.presence = presence;
        this.renderPresenceTooltip();
        this.changeEmitter.fire();
      },
      onStatus: (status) => this.renderStatus(roomCode, status),
      onActivity: (event) => {
        this.activity = [event, ...this.activity].slice(0, MAX_ACTIVITY);
        this.changeEmitter.fire();
      },
      onChat: (message) => {
        this.chat = [...this.chat, message].slice(-MAX_CHAT);
        if (message.participantId) this.clearTyping(message.participantId);
        this.changeEmitter.fire();
      },
      onChatTyping: (indicator, typing) =>
        this.updateTyping(indicator, typing),
      onSelf: (id) => {
        this.selfId = id;
        this.changeEmitter.fire();
      }
    });
    this.session.connect();
    this.renderStatus(roomCode, "connecting");
    this.statusBar.show();
    void this.loadHistory(config, roomCode);
  }

  private updateTyping(indicator: TypingIndicator, typing: boolean): void {
    if (!typing) {
      this.clearTyping(indicator.participantId);
      this.changeEmitter.fire();
      return;
    }
    const existing = this.typing.get(indicator.participantId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.typing.delete(indicator.participantId);
      this.changeEmitter.fire();
    }, TYPING_EXPIRY_MS);
    this.typing.set(indicator.participantId, {
      displayName: indicator.displayName,
      timer
    });
    this.changeEmitter.fire();
  }

  private clearTyping(participantId: string): void {
    const existing = this.typing.get(participantId);
    if (existing) {
      clearTimeout(existing.timer);
      this.typing.delete(participantId);
    }
  }

  private async loadHistory(
    config: ExtensionConfig,
    roomCode: string
  ): Promise<void> {
    try {
      const http = new HttpClient(config.serverUrlHttp);
      const [activity, chat] = await Promise.all([
        http.getActivity(roomCode, 50),
        http.getChat(roomCode, 50)
      ]);
      if (this.roomCode === roomCode) {
        this.activity = activity;
        // Chat history arrives newest-first; display chronologically.
        this.chat = [...chat].reverse();
        this.changeEmitter.fire();
      }
    } catch {
      // Non-fatal: the live feed still works without history.
    }
  }

  private renderStatus(roomCode: string, status: ConnectionStatus): void {
    this.statusBar.text = `$(broadcast) CodeSync: ${roomCode} · ${status}`;
  }

  private renderPresenceTooltip(): void {
    const names = this.presence.map((p) => p.displayName).join(", ");
    this.statusBar.tooltip = `Online: ${names || "just you"} — click to leave`;
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
