import * as vscode from "vscode";
import type { Awareness } from "y-protocols/awareness";
import type { CursorState } from "@codesync/shared";
import { relativePath } from "../util/uri";

const TYPING_RESET_MS = 1200;

/**
 * Publishes the local user's cursor/selection and a transient "typing" flag
 * into Yjs awareness, so peers can render live cursors and typing indicators.
 * Uses setLocalStateField so it never clobbers the identity fields set on join.
 */
export class CursorTracker {
  private readonly disposables: vscode.Disposable[] = [];
  private typingTimer: NodeJS.Timeout | null = null;

  constructor(private readonly awareness: Awareness) {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => this.onSelection(e))
    );
  }

  /** Publish the current active editor's selection immediately (e.g. on join). */
  publishCurrent(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) this.publish(editor.document, editor.selection);
  }

  private onSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    const selection = e.selections[0];
    if (!selection) return;
    this.publish(e.textEditor.document, selection);
    if (e.kind === vscode.TextEditorSelectionChangeKind.Keyboard) {
      this.markTyping();
    }
  }

  private publish(document: vscode.TextDocument, selection: vscode.Selection): void {
    const cursor: CursorState = {
      file: relativePath(document),
      anchor: {
        line: selection.anchor.line,
        character: selection.anchor.character
      },
      head: { line: selection.active.line, character: selection.active.character }
    };
    this.awareness.setLocalStateField("cursor", cursor);
  }

  private markTyping(): void {
    this.awareness.setLocalStateField("typing", true);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.awareness.setLocalStateField("typing", false);
    }, TYPING_RESET_MS);
  }

  dispose(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    for (const d of this.disposables) d.dispose();
  }
}
