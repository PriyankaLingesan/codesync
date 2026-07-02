import type * as vscode from "vscode";
import type { HostToWebview } from "@codesync/shared";
import { BaseWebviewViewProvider } from "./BaseWebviewViewProvider";
import type { CollaborationView } from "./CollaborationView";

/** The "Activity" panel: collaboration timeline / feed. */
export class ActivityViewProvider extends BaseWebviewViewProvider {
  static readonly viewId = "codesync.activity";

  constructor(extensionUri: vscode.Uri, source: CollaborationView) {
    super(extensionUri, source, "activity");
  }

  protected buildMessages(): HostToWebview[] {
    return [
      {
        type: "session",
        roomCode: this.source.getRoomCode(),
        selfId: this.source.getSelfId()
      },
      { type: "activity", events: this.source.getActivity() }
    ];
  }
}
