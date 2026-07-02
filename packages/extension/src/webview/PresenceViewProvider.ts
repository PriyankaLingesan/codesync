import type * as vscode from "vscode";
import type { HostToWebview } from "@codesync/shared";
import { BaseWebviewViewProvider } from "./BaseWebviewViewProvider";
import type { CollaborationView } from "./CollaborationView";

/** The "Collaborators" panel: live online users, avatars, status. */
export class PresenceViewProvider extends BaseWebviewViewProvider {
  static readonly viewId = "codesync.presence";

  constructor(extensionUri: vscode.Uri, source: CollaborationView) {
    super(extensionUri, source, "presence");
  }

  protected buildMessages(): HostToWebview[] {
    return [
      {
        type: "session",
        roomCode: this.source.getRoomCode(),
        selfId: this.source.getSelfId()
      },
      { type: "presence", presence: this.source.getPresence() }
    ];
  }
}
