import type * as vscode from "vscode";
import type {
  ActivityEvent,
  ChatMessage,
  Presence,
  TypingIndicator
} from "@codesync/shared";

/**
 * Read-only view of the current collaboration session that the webview
 * providers render from. Implemented by SessionController.
 */
export interface CollaborationView {
  getRoomCode(): string | null;
  getSelfId(): string | null;
  getPresence(): Presence[];
  getActivity(): ActivityEvent[];
  getChat(): ChatMessage[];
  getChatTyping(): TypingIndicator[];
  /** Fires whenever presence, activity, chat, or identity changes. */
  readonly onDidChange: vscode.Event<void>;
}
