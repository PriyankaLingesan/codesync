import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates
} from "y-protocols/awareness";
import type { Base64, Presence } from "@codesync/shared";
import type { Client, Room } from "../domain/room.js";

const toBase64 = (bytes: Uint8Array): Base64 =>
  Buffer.from(bytes).toString("base64");

const fromBase64 = (b64: Base64): Uint8Array =>
  new Uint8Array(Buffer.from(b64, "base64"));

/**
 * The synchronization engine. Stateless service that encapsulates all Yjs
 * document and awareness operations, keeping transport (WS handler) and
 * lifecycle (RoomManager) free of CRDT details.
 */
export class SyncEngine {
  /** Full document state to bootstrap a newly joined client. */
  encodeState(room: Room): Base64 {
    return toBase64(Y.encodeStateAsUpdate(room.doc));
  }

  /** Apply a client's incremental document update to the authoritative doc. */
  applyDocUpdate(room: Room, update: Base64): void {
    Y.applyUpdate(room.doc, fromBase64(update), "remote");
  }

  /** Apply an incoming awareness update, attributed to the origin client. */
  applyAwareness(room: Room, update: Base64, origin: Client): void {
    applyAwarenessUpdate(room.awareness, fromBase64(update), origin);
  }

  /** Encode the current awareness state for the given client IDs. */
  encodeAwareness(room: Room, clientIds: number[]): Base64 {
    return toBase64(encodeAwarenessUpdate(room.awareness, clientIds));
  }

  /**
   * Remove a disconnecting client's awareness entries.
   * Returns the removed awareness client IDs so peers can be notified.
   */
  clearAwareness(room: Room, origin: Client): number[] {
    const ids = [...origin.controlledAwarenessIds];
    if (ids.length > 0) {
      removeAwarenessStates(room.awareness, ids, origin);
    }
    return ids;
  }

  /** Read the awareness presence a specific client currently publishes. */
  readClientPresence(room: Room, client: Client): Partial<Presence> | null {
    const states = room.awareness.getStates();
    for (const id of client.controlledAwarenessIds) {
      const state = states.get(id);
      if (state) return state as Partial<Presence>;
    }
    return null;
  }

  /**
   * Build the online roster from connected clients, enriched with awareness
   * data (cursor / typing / active file) when available. Deriving from the
   * client set — not awareness alone — guarantees the roster is correct the
   * instant someone joins or leaves, before any awareness frame arrives.
   */
  buildPresence(room: Room): Presence[] {
    const byParticipant = new Map<string, Partial<Presence>>();
    for (const state of room.awareness.getStates().values()) {
      const p = state as Partial<Presence>;
      if (p && typeof p.participantId === "string") {
        byParticipant.set(p.participantId, p);
      }
    }

    return [...room.clients].map((client): Presence => {
      const a = byParticipant.get(client.participant.id);
      return {
        participantId: client.participant.id,
        displayName: client.participant.displayName,
        color: client.participant.color,
        status: a?.status ?? "active",
        activeFile: a?.activeFile ?? null,
        typing: a?.typing ?? false,
        cursor: a?.cursor ?? null
      };
    });
  }
}
