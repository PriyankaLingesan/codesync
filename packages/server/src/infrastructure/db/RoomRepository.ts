import type { Room as RoomRecord } from "@codesync/shared";
import type { Pool } from "./pool.js";

interface RoomRow {
  id: string;
  room_code: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: RoomRow): RoomRecord {
  return {
    id: row.id,
    roomCode: row.room_code,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

/** Persistence for the `rooms` table. */
export class RoomRepository {
  constructor(private readonly pool: Pool) {}

  async create(roomCode: string, name: string): Promise<RoomRecord> {
    const { rows } = await this.pool.query<RoomRow>(
      `INSERT INTO rooms (room_code, name) VALUES ($1, $2) RETURNING *`,
      [roomCode, name]
    );
    return toRecord(rows[0]);
  }

  async findByCode(roomCode: string): Promise<RoomRecord | null> {
    const { rows } = await this.pool.query<RoomRow>(
      `SELECT * FROM rooms WHERE room_code = $1`,
      [roomCode]
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }
}
