import * as Y from "yjs";
import type { Config } from "../config.js";
import { Room, type Client } from "../domain/room.js";
import type { RoomRepository } from "../infrastructure/db/RoomRepository.js";
import type { SnapshotRepository } from "../infrastructure/db/SnapshotRepository.js";

/** Shape of the payload emitted by the awareness "update" event. */
interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

/**
 * Owns the in-memory lifecycle of rooms: loading them (with their latest
 * snapshot) on first use, scheduling debounced snapshots as they change,
 * and disposing them once the last client leaves.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly snapshotRepo: SnapshotRepository,
    private readonly config: Config
  ) {}

  /** Look up a room by its code, loading it into memory if needed. */
  async getOrLoadByCode(roomCode: string): Promise<Room | null> {
    const record = await this.roomRepo.findByCode(roomCode);
    if (!record) return null;

    const existing = this.rooms.get(record.id);
    if (existing) return existing;

    const room = new Room(record);
    const snapshot = await this.snapshotRepo.findLatest(record.id);
    if (snapshot) {
      Y.applyUpdate(room.doc, snapshot, "load");
    }
    this.attachListeners(room);
    this.rooms.set(record.id, room);
    return room;
  }

  private attachListeners(room: Room): void {
    // Any real edit marks the room dirty and (re)arms the snapshot timer.
    room.doc.on("update", (_update: Uint8Array, origin: unknown) => {
      if (origin === "load") return;
      room.dirty = true;
      this.scheduleSnapshot(room);
    });

    // Track which awareness IDs each client controls so we can clean them up.
    room.awareness.on("update", (change: AwarenessChange, origin: unknown) => {
      const client = origin as Client | null;
      if (client && typeof client === "object" && "controlledAwarenessIds" in client) {
        for (const id of change.added) client.controlledAwarenessIds.add(id);
        for (const id of change.updated) client.controlledAwarenessIds.add(id);
        for (const id of change.removed) client.controlledAwarenessIds.delete(id);
      }
    });
  }

  private scheduleSnapshot(room: Room): void {
    if (room.snapshotTimer) clearTimeout(room.snapshotTimer);
    room.snapshotTimer = setTimeout(() => {
      void this.persist(room);
    }, this.config.snapshotDebounceMs);
  }

  /** Persist the current document state if there are unsaved changes. */
  async persist(room: Room): Promise<void> {
    if (!room.dirty) return;
    const state = Y.encodeStateAsUpdate(room.doc);
    await this.snapshotRepo.save(room.record.id, Buffer.from(state));
    room.dirty = false;
  }

  /** After a client leaves: if the room is empty, snapshot and unload it. */
  async disposeIfEmpty(room: Room): Promise<void> {
    if (room.clients.size > 0) return;
    if (room.snapshotTimer) {
      clearTimeout(room.snapshotTimer);
      room.snapshotTimer = null;
    }
    await this.persist(room);
    room.awareness.destroy();
    room.doc.destroy();
    this.rooms.delete(room.record.id);
  }
}
