import * as vscode from "vscode";
import * as Y from "yjs";

const LOCAL_ORIGIN = "local";

/**
 * Two-way binding between a VS Code TextDocument and a Y.Text.
 *
 * - Local editor edits are written into the Y.Text (origin "local").
 * - Remote Y.Text changes are applied back into the editor, guarded so they
 *   don't echo out as new local edits.
 *
 * Remote applications are serialized through a promise queue so overlapping
 * updates can't interleave and corrupt the applying-remote guard.
 */
export class DocumentBinding {
  private readonly ytext: Y.Text;
  private readonly observer: (event: Y.YTextEvent) => void;
  private readonly disposables: vscode.Disposable[] = [];
  private applyingRemote = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly doc: Y.Doc,
    private readonly document: vscode.TextDocument,
    fileKey: string
  ) {
    this.ytext = doc.getText(fileKey);

    if (this.ytext.length === 0) {
      // First participant for this file: seed the shared text with local content.
      const text = document.getText();
      if (text.length > 0) {
        doc.transact(() => this.ytext.insert(0, text), LOCAL_ORIGIN);
      }
    } else {
      // Shared content already exists: adopt it into the local editor.
      this.enqueue(() => this.replaceEditorContent(this.ytext.toString()));
    }

    this.observer = (event) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return;
      this.enqueue(() => this.applyDelta(event.delta));
    };
    this.ytext.observe(this.observer);

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() !== this.document.uri.toString()) return;
        if (this.applyingRemote) return;
        this.onEditorChange(e.contentChanges);
      })
    );
  }

  /** Editor -> Y.Text: translate VS Code content changes into Y.Text ops. */
  private onEditorChange(
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    if (changes.length === 0) return;
    this.doc.transact(() => {
      // Apply from the end of the document backwards so earlier offsets remain
      // valid as we mutate.
      const ordered = [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
      for (const change of ordered) {
        if (change.rangeLength > 0) {
          this.ytext.delete(change.rangeOffset, change.rangeLength);
        }
        if (change.text.length > 0) {
          this.ytext.insert(change.rangeOffset, change.text);
        }
      }
    }, LOCAL_ORIGIN);
  }

  /** Y.Text -> editor: apply a Yjs delta as an atomic editor edit. */
  private async applyDelta(delta: Y.YTextEvent["delta"]): Promise<void> {
    const editor = await this.showDocument();
    if (!editor) return;

    this.applyingRemote = true;
    try {
      await editor.edit(
        (builder) => {
          let offset = 0; // offset in the pre-edit document
          for (const op of delta) {
            if (typeof op.retain === "number") {
              offset += op.retain;
            } else if (typeof op.insert === "string") {
              builder.insert(this.document.positionAt(offset), op.insert);
              // Inserts add new chars; original-document offset does not advance.
            } else if (typeof op.delete === "number") {
              const start = this.document.positionAt(offset);
              const end = this.document.positionAt(offset + op.delete);
              builder.delete(new vscode.Range(start, end));
              offset += op.delete;
            }
          }
        },
        { undoStopBefore: false, undoStopAfter: false }
      );
    } finally {
      this.applyingRemote = false;
    }
  }

  private async replaceEditorContent(text: string): Promise<void> {
    const editor = await this.showDocument();
    if (!editor) return;

    this.applyingRemote = true;
    try {
      const fullRange = new vscode.Range(
        this.document.positionAt(0),
        this.document.positionAt(this.document.getText().length)
      );
      await editor.edit((builder) => builder.replace(fullRange, text), {
        undoStopBefore: false,
        undoStopAfter: false
      });
    } finally {
      this.applyingRemote = false;
    }
  }

  private async showDocument(): Promise<vscode.TextEditor | undefined> {
    const visible = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === this.document.uri.toString()
    );
    if (visible) return visible;
    return vscode.window.showTextDocument(this.document, {
      preserveFocus: true,
      preview: false
    });
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch(() => undefined);
  }

  dispose(): void {
    this.ytext.unobserve(this.observer);
    for (const d of this.disposables) d.dispose();
  }
}
