import type * as vscode from "vscode";
import type { HostToWebview, WebviewToHost } from "@codesync/shared";
import { BaseWebviewViewProvider } from "./BaseWebviewViewProvider";
import type { CollaborationView } from "./CollaborationView";

/** Outbound actions the chat panel triggers on the host. */
export interface ChatBridge {
  sendChat(body: string): void;
  sendChatTyping(typing: boolean): void;
}

/** The "Chat" panel: workspace chat with history and typing indicators. */
export class ChatViewProvider extends BaseWebviewViewProvider {
  static readonly viewId = "codesync.chat";

  constructor(
    extensionUri: vscode.Uri,
    source: CollaborationView,
    private readonly bridge: ChatBridge
  ) {
    super(extensionUri, source, "chat");
  }

  protected buildMessages(): HostToWebview[] {
    return [
      {
        type: "session",
        roomCode: this.source.getRoomCode(),
        selfId: this.source.getSelfId()
      },
      { type: "chat", messages: this.source.getChat() },
      { type: "chat:typing", typing: this.source.getChatTyping() }
    ];
  }

  protected override onMessage(message: WebviewToHost): void {
    if (message.type === "chat:send") {
      this.bridge.sendChat(message.body);
    } else if (message.type === "chat:typing") {
      this.bridge.sendChatTyping(message.typing);
    }
  }
}
