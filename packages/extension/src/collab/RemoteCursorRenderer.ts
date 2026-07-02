import * as vscode from "vscode";
import type { Awareness } from "y-protocols/awareness";
import type { CursorState, Presence } from "@codesync/shared";
import { relativePath } from "../util/uri";
import { toRgba } from "../util/color";

interface ParticipantDecorations {
  /** Caret (colored left border) + name label. */
  cursor: vscode.TextEditorDecorationType;
  /** Selection range highlight. */
  selection: vscode.TextEditorDecorationType;
}

interface RemoteCursor {
  participantId: string;
  name: string;
  color: string;
  cursor: CursorState;
}

/**
 * Renders remote collaborators' cursors and selections as editor decorations:
 * a colored caret with a name label plus a translucent selection highlight,
 * one color per participant. Re-renders on awareness changes and editor
 * changes, and cleans up decorations for participants who leave.
 */
export class RemoteCursorRenderer {
  private readonly types = new Map<string, ParticipantDecorations>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onChange: () => void;

  constructor(
    private readonly awareness: Awareness,
    private readonly localClientId: number
  ) {
    this.onChange = () => this.render();
    this.awareness.on("change", this.onChange);
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.render()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.render())
    );
  }

  private render(): void {
    const remotes = this.collectRemotes();
    const activeIds = new Set(remotes.map((r) => r.participantId));

    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = relativePath(editor.document);
      const shownHere = new Set<string>();

      for (const remote of remotes) {
        if (remote.cursor.file !== filePath) continue;
        shownHere.add(remote.participantId);

        const deco = this.decorationsFor(remote);
        const anchor = editor.document.validatePosition(
          new vscode.Position(remote.cursor.anchor.line, remote.cursor.anchor.character)
        );
        const head = editor.document.validatePosition(
          new vscode.Position(remote.cursor.head.line, remote.cursor.head.character)
        );

        editor.setDecorations(deco.cursor, [new vscode.Range(head, head)]);
        editor.setDecorations(
          deco.selection,
          anchor.isEqual(head) ? [] : [new vscode.Range(anchor, head)]
        );
      }

      // Clear participants not currently in this editor's file.
      for (const [participantId, deco] of this.types) {
        if (!shownHere.has(participantId)) {
          editor.setDecorations(deco.cursor, []);
          editor.setDecorations(deco.selection, []);
        }
      }
    }

    // Dispose decoration types for participants who have left entirely.
    for (const [participantId, deco] of [...this.types]) {
      if (!activeIds.has(participantId)) {
        deco.cursor.dispose();
        deco.selection.dispose();
        this.types.delete(participantId);
      }
    }
  }

  private collectRemotes(): RemoteCursor[] {
    const remotes: RemoteCursor[] = [];
    for (const [clientId, raw] of this.awareness.getStates()) {
      if (clientId === this.localClientId) continue;
      const p = raw as Partial<Presence>;
      if (typeof p.participantId !== "string" || !p.cursor) continue;
      remotes.push({
        participantId: p.participantId,
        name: p.displayName ?? "?",
        color: p.color ?? "#888888",
        cursor: p.cursor
      });
    }
    return remotes;
  }

  private decorationsFor(remote: RemoteCursor): ParticipantDecorations {
    const existing = this.types.get(remote.participantId);
    if (existing) return existing;

    const created: ParticipantDecorations = {
      cursor: vscode.window.createTextEditorDecorationType({
        borderStyle: "solid",
        borderColor: remote.color,
        borderWidth: "0 0 0 2px",
        after: {
          contentText: ` ${remote.name} `,
          color: "#ffffff",
          backgroundColor: remote.color,
          margin: "0 0 0 2px",
          fontWeight: "600"
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
      }),
      selection: vscode.window.createTextEditorDecorationType({
        backgroundColor: toRgba(remote.color, 0.18),
        borderRadius: "2px"
      })
    };
    this.types.set(remote.participantId, created);
    return created;
  }

  dispose(): void {
    this.awareness.off("change", this.onChange);
    for (const deco of this.types.values()) {
      deco.cursor.dispose();
      deco.selection.dispose();
    }
    this.types.clear();
    for (const d of this.disposables) d.dispose();
  }
}
