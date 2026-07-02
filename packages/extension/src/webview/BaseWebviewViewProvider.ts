import * as vscode from "vscode";
import type { HostToWebview, WebviewToHost } from "@codesync/shared";
import type { CollaborationView } from "./CollaborationView";

/**
 * Shared plumbing for CodeSync webview panels: loads the bundled React app from
 * media/, wires host<->webview messaging, and re-posts data on every change.
 */
export abstract class BaseWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  protected view: vscode.WebviewView | undefined;
  private readonly subscription: vscode.Disposable;

  constructor(
    protected readonly extensionUri: vscode.Uri,
    protected readonly source: CollaborationView,
    private readonly entry: "presence" | "activity" | "chat"
  ) {
    this.subscription = source.onDidChange(() => this.post());
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
    };
    view.webview.html = this.render(view.webview);
    view.webview.onDidReceiveMessage((message: WebviewToHost) => {
      if (message.type === "ready") {
        this.post();
        return;
      }
      this.onMessage(message);
    });
  }

  /** The messages to (re)send whenever data changes or the webview is ready. */
  protected abstract buildMessages(): HostToWebview[];

  /** Handle non-"ready" messages from the webview. Override as needed. */
  protected onMessage(_message: WebviewToHost): void {
    // default: no-op
  }

  protected post(): void {
    if (!this.view) return;
    for (const message of this.buildMessages()) {
      void this.view.webview.postMessage(message);
    }
  }

  private render(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", `${this.entry}.js`)
    );
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  dispose(): void {
    this.subscription.dispose();
  }
}

function makeNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 24; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
