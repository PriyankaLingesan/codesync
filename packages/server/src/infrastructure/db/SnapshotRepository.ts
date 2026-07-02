import type { Pool } from "./pool.js";

interface SnapshotRow {
  state: Buffer;
}

/**
 * Persistence for `yjs_snapshots`. Stores/loads the binary Yjs document state
 * (Y.encodeStateAsUpdate) as BYTEA. The newest row per room is the load target.
 */
export class SnapshotRepository {
  constructor(private readonly pool: Pool) {}

  async findLatest(roomId: string): Promise<Uint8Array | null> {
    const { rows } = await this.pool.query<SnapshotRow>(
      `SELECT state FROM yjs_snapshots
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [roomId]
    );
    return rows[0] ? new Uint8Array(rows[0].state) : null;
  }

  async save(roomId: string, state: Buffer): Promise<void> {
    await this.pool.query(
      `INSERT INTO yjs_snapshots (room_id, state) VALUES ($1, $2)`,
      [roomId, state]
    );
  }
}
