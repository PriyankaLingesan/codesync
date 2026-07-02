import * as vscode from "vscode";
import * as os from "node:os";

export interface ExtensionConfig {
  /** WebSocket base, e.g. ws://localhost:4000 (no trailing slash). */
  serverUrlWs: string;
  /** HTTP base derived from the WS URL, e.g. http://localhost:4000. */
  serverUrlHttp: string;
  /** Name shown to collaborators. */
  displayName: string;
}

/** Read and normalize CodeSync settings from VS Code configuration. */
export function readConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration("codesync");
  const serverUrlWs = (cfg.get<string>("serverUrl") ?? "ws://localhost:4000").replace(
    /\/+$/,
    ""
  );
  const serverUrlHttp = serverUrlWs.replace(/^ws/, "http");
  const configured = (cfg.get<string>("displayName") ?? "").trim();
  const displayName = configured || safeUsername();
  return { serverUrlWs, serverUrlHttp, displayName };
}

function safeUsername(): string {
  try {
    return os.userInfo().username || "Anonymous";
  } catch {
    return "Anonymous";
  }
}
