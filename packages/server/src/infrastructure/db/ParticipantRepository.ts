import type { Participant } from "@codesync/shared";
import type { Pool } from "./pool.js";

interface ParticipantRow {
  id: string;
  room_id: string;
  display_name: string;
  color: string;
  first_seen_at: Date;
  last_seen_at: Date;
}

function toRecord(row: ParticipantRow): Participant {
  return {
    id: row.id,
    roomId: row.room_id,
    displayName: row.display_name,
    color: row.color,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString()
  };
}

/** Persistence for the `participants` table. */
export class ParticipantRepository {
  constructor(private readonly pool: Pool) {}

  async create(
    roomId: string,
    displayName: string,
    color: string
  ): Promise<Participant> {
    const { rows } = await this.pool.query<ParticipantRow>(
      `INSERT INTO participants (room_id, display_name, color)
       VALUES ($1, $2, $3) RETURNING *`,
      [roomId, displayName, color]
    );
    return toRecord(rows[0]);
  }

  async touch(participantId: string): Promise<void> {
    await this.pool.query(
      `UPDATE participants SET last_seen_at = now() WHERE id = $1`,
      [participantId]
    );
  }
}
