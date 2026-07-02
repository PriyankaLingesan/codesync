import * as vscode from "vscode";
import type { WebviewToHost } from "@codesync/shared";
import { ImportGraphAnalyzer } from "../analysis/ImportGraphAnalyzer";

const SOURCE_GLOB = "**/*.{ts,tsx,js,jsx,mjs,cjs}";

/**
 * A full editor-area webview panel that renders the codebase dependency/import
 * graph. Singleton: reveals the existing panel if already open. Refreshes live
 * when source files change.
 */
export class GraphPanel {
  private static current: GraphPanel | undefined;

  static createOrShow(
    extensionUri: vscode.Uri,
    analyzer: ImportGraphAnalyzer
  ): void {
    const column = vscode.ViewColumn.Beside;
    if (GraphPanel.current) {
      GraphPanel.current.panel.reveal(column);
      void GraphPanel.current.refresh();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "codesync.graph",
      "CodeSync: Dependency Graph",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")]
      }
    );
    GraphPanel.current = new GraphPanel(panel, extensionUri, analyzer);
  }

  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly analyzer: ImportGraphAnalyzer
  ) {
    this.panel.webview.html = renderHtml(this.panel.webview, extensionUri);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToHost) => {
        if (message.type === "ready" || message.type === "refresh") {
          void this.refresh();
        } else if (message.type === "open-file") {
          void this.openFile(message.path);
        }
      },
      null,
      this.disposables
    );

    // Live refresh as the codebase changes.
    const watcher = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
    const onChange = (): void => void this.refresh();
    watcher.onDidCreate(onChange, null, this.disposables);
    watcher.onDidChange(onChange, null, this.disposables);
    watcher.onDidDelete(onChange, null, this.disposables);
    this.disposables.push(watcher);
  }

  private async refresh(): Promise<void> {
    const graph = await this.analyzer.build();
    void this.panel.webview.postMessage({ type: "graph", graph });
  }

  private async openFile(relPath: string): Promise<void> {
    if (relPath.startsWith("npm:")) return; // external package, nothing to open
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const uri = vscode.Uri.joinPath(folder.uri, relPath);
      try {
        await vscode.workspace.fs.stat(uri);
        await vscode.window.showTextDocument(uri, { preview: true });
        return;
      } catch {
        // try next folder
      }
    }
  }

  private dispose(): void {
    GraphPanel.current = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = makeNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "graph.js")
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

function makeNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 24; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
