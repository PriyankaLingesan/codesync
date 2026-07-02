import type { ChatMessage } from "@codesync/shared";
import type { Pool } from "./pool.js";

interface ChatRow {
  id: string;
  room_id: string;
  participant_id: string | null;
  author_name: string;
  body: string;
  created_at: Date;
}

function toRecord(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    participantId: row.participant_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at.toISOString()
  };
}

/** Persistence for the `chat_messages` table. */
export class ChatRepository {
  constructor(private readonly pool: Pool) {}

  async create(
    roomId: string,
    participantId: string,
    authorName: string,
    body: string
  ): Promise<ChatMessage> {
    const { rows } = await this.pool.query<ChatRow>(
      `INSERT INTO chat_messages (room_id, participant_id, author_name, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [roomId, participantId, authorName, body]
    );
    return toRecord(rows[0]);
  }

  /** Most recent messages first; optional keyset pagination via `before`. */
  async list(
    roomId: string,
    limit: number,
    before?: string
  ): Promise<ChatMessage[]> {
    if (before) {
      const { rows } = await this.pool.query<ChatRow>(
        `SELECT * FROM chat_messages
         WHERE room_id = $1 AND created_at < $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [roomId, before, limit]
      );
      return rows.map(toRecord);
    }
    const { rows } = await this.pool.query<ChatRow>(
      `SELECT * FROM chat_messages
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [roomId, limit]
    );
    return rows.map(toRecord);
  }
}
