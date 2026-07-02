import type { ActivityEvent, ActivityType } from "@codesync/shared";
import type { Pool } from "./pool.js";

interface ActivityRow {
  id: string;
  room_id: string;
  participant_id: string | null;
  actor_name: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: Date;
}

function toRecord(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    participantId: row.participant_id,
    actorName: row.actor_name,
    type: row.type as ActivityType,
    payload: row.payload,
    createdAt: row.created_at.toISOString()
  };
}

/** Persistence for the append-only `activity_events` feed. */
export class ActivityRepository {
  constructor(private readonly pool: Pool) {}

  async create(
    roomId: string,
    participantId: string,
    actorName: string,
    type: ActivityType,
    payload: Record<string, unknown>
  ): Promise<ActivityEvent> {
    const { rows } = await this.pool.query<ActivityRow>(
      `INSERT INTO activity_events (room_id, participant_id, actor_name, type, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [roomId, participantId, actorName, type, JSON.stringify(payload)]
    );
    return toRecord(rows[0]);
  }

  /** Most recent events first; optional keyset pagination via `before`. */
  async list(
    roomId: string,
    limit: number,
    before?: string
  ): Promise<ActivityEvent[]> {
    if (before) {
      const { rows } = await this.pool.query<ActivityRow>(
        `SELECT * FROM activity_events
         WHERE room_id = $1 AND created_at < $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [roomId, before, limit]
      );
      return rows.map(toRecord);
    }
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT * FROM activity_events
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [roomId, limit]
    );
    return rows.map(toRecord);
  }
}
