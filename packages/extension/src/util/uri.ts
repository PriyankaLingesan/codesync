import * as vscode from "vscode";

/** Workspace-relative path for a document (used for presence + Y.Text keys). */
export function relativePath(document: vscode.TextDocument): string {
  return vscode.workspace.asRelativePath(document.uri, false);
}

/**
 * Stable Y.Text key for a document. Only regular files on disk participate in
 * collaboration; untitled/virtual documents are ignored (returns null).
 */
export function fileKeyFor(document: vscode.TextDocument): string | null {
  if (document.uri.scheme !== "file") return null;
  return `file:${relativePath(document)}`;
}
