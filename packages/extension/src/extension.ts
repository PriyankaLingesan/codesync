import * as vscode from "vscode";
import { SessionController } from "./SessionController";
import { PresenceViewProvider } from "./webview/PresenceViewProvider";
import { ActivityViewProvider } from "./webview/ActivityViewProvider";
import { ChatViewProvider } from "./webview/ChatViewProvider";
import { GraphPanel } from "./webview/GraphPanel";
import { ImportGraphAnalyzer } from "./analysis/ImportGraphAnalyzer";

/** Extension entry point. Registers commands, panels, and the controller. */
export function activate(context: vscode.ExtensionContext): void {
  const controller = new SessionController(context);
  const presenceProvider = new PresenceViewProvider(context.extensionUri, controller);
  const activityProvider = new ActivityViewProvider(context.extensionUri, controller);
  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    controller,
    controller
  );
  const graphAnalyzer = new ImportGraphAnalyzer();

  context.subscriptions.push(
    new vscode.Disposable(() => controller.dispose()),
    presenceProvider,
    activityProvider,
    chatProvider,
    vscode.window.registerWebviewViewProvider(
      PresenceViewProvider.viewId,
      presenceProvider
    ),
    vscode.window.registerWebviewViewProvider(
      ActivityViewProvider.viewId,
      activityProvider
    ),
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewId,
      chatProvider
    ),
    vscode.commands.registerCommand("codesync.createRoom", () =>
      controller.createRoom()
    ),
    vscode.commands.registerCommand("codesync.joinRoom", () =>
      controller.joinRoom()
    ),
    vscode.commands.registerCommand("codesync.leaveRoom", () =>
      controller.leave()
    ),
    vscode.commands.registerCommand("codesync.showGraph", () =>
      GraphPanel.createOrShow(context.extensionUri, graphAnalyzer)
    )
  );
}

export function deactivate(): void {
  // Session cleanup happens via context.subscriptions disposables.
}
