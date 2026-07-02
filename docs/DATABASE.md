# CodeSync — Database Design

Single PostgreSQL database. DDL lives in
[`packages/server/db/schema.sql`](../packages/server/db/schema.sql) and is
loaded automatically by `docker-compose.dev.yml` on first start.

## Design principles

- **Postgres is for durable, queryable data** — room metadata, participants,
  Yjs snapshots, chat history, and the activity feed. It is **not** on the
  realtime hot path; live edits and presence flow through the in-memory `Y.Doc`
  and awareness over WebSocket.
- **Snapshots, not per-keystroke rows.** The Yjs document is stored as periodic
  binary snapshots (`BYTEA`), not as a stream of operations. This keeps writes
  cheap and restart recovery a single row read.
- **Denormalized author/actor names.** `chat_messages` and `activity_events`
  copy the display name at write time so history stays readable even if a
  participant row is removed (`ON DELETE SET NULL` on the FK).
- **Cascade on room delete.** Deleting a room removes all of its participants,
  snapshots, chat, and activity in one operation.

## Entity relationships

```
rooms 1 ──< participants          (a room has many participants)
rooms 1 ──< yjs_snapshots         (a room has many snapshots; newest = current)
rooms 1 ──< chat_messages         (a room has many chat messages)
rooms 1 ──< activity_events       (a room has many activity events)

participants 1 ──< chat_messages     (nullable: SET NULL on participant delete)
participants 1 ──< activity_events   (nullable: SET NULL on participant delete)
```

## Tables

### `rooms`
The collaboration room. `room_code` is the short shareable identifier used to
join (unique). `id` (UUID) is the internal key used by all foreign keys.

### `participants`
A person who joined a room, identified by `display_name` and an assigned
`color` (used for cursors/labels). `last_seen_at` supports presence/cleanup.
No credentials are stored — this is the room-code identity model.

### `yjs_snapshots`
Binary Yjs state (`Y.encodeStateAsUpdate(doc)`) per room. The row with the
greatest `created_at` for a room is the load target when the room is re-opened.
Index `idx_snapshots_room_created` makes "latest snapshot" an index-only seek.

### `chat_messages`
Persisted workspace chat (Phase 4). Ordered by `created_at`; paginated for
history. `author_name` is denormalized so old messages read correctly.

### `activity_events`
Append-only feed (Phase 3). `type` is one of `join`, `leave`, `file_open`,
`edit`, `chat`; `payload` (JSONB) carries type-specific detail such as the file
path being edited. Powers the "who is editing which file", recent edits, and
timeline views.

## Snapshot lifecycle

1. **Room open:** read the latest `yjs_snapshots` row → `Y.applyUpdate`.
2. **Active:** debounced snapshot every `SNAPSHOT_DEBOUNCE_MS` of edit activity.
3. **Last participant leaves:** write a final snapshot, then drop the in-memory
   `Y.Doc`.

## Retention (optional, later)
A simple periodic job can keep only the N most recent snapshots per room. Not
required for the portfolio scope and intentionally left out of Phase 0.
