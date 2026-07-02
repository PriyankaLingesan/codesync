import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { WebSocket } from "ws";
import type { Participant, Room as RoomRecord } from "@codesync/shared";

/**
 * A connected client within a room: its socket, the participant it represents,
 * and the awareness client IDs it "controls" (so they can be cleaned up on
 * disconnect). Used as the awareness update `origin` for attribution.
 */
export interface Client {
  connectionId: string;
  socket: WebSocket;
  participant: Participant;
  controlledAwarenessIds: Set<number>;
  /** Last active file seen for this client (drives file_open activity). */
  lastActiveFile: string | null;
  /** Timestamp of the last emitted "edit" activity (for throttling). */
  lastEditAt: number;
}

/**
 * The authoritative live state of a collaboration room, held in memory.
 * - `doc` is the shared Yjs document all clients converge to.
 * - `awareness` carries ephemeral presence (cursors, selections, typing).
 * - `clients` is the set of currently connected sockets.
 */
export class Room {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly clients: Set<Client>;
  /** True when the doc has unsaved changes since the last snapshot. */
  dirty: boolean;
  /** Debounce handle for the next snapshot; null when none scheduled. */
  snapshotTimer: NodeJS.Timeout | null;

  constructor(public readonly record: RoomRecord) {
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);
    // The server is a relay, not a participant — clear its own awareness slot.
    this.awareness.setLocalState(null);
    this.clients = new Set<Client>();
    this.dirty = false;
    this.snapshotTimer = null;
  }
}
