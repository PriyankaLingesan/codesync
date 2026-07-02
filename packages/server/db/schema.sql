-- CodeSync — PostgreSQL schema
-- Phase 0 design deliverable. Idempotent: safe to run repeatedly.
-- Loaded automatically by docker-compose.dev.yml on first container start.

BEGIN;

-- UUID generation without extra extensions (Postgres 13+).
-- We use gen_random_uuid() from pgcrypto; enable it if not present.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- rooms
-- A collaboration room. Identified publicly by a short, shareable room_code.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code   TEXT        NOT NULL UNIQUE,            -- e.g. "indigo-otter-42"
    name        TEXT        NOT NULL,                   -- human-friendly room name
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- participants
-- A person who has joined a room. Identity = display name + assigned color.
-- No auth; participant_id is the stable handle used across WS + activity.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id       UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    display_name  TEXT        NOT NULL,
    color         TEXT        NOT NULL,                 -- hex, e.g. "#e57373"
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);

-- ---------------------------------------------------------------------------
-- yjs_snapshots
-- Binary snapshots of a room's Yjs document (Y.encodeStateAsUpdate).
-- We keep a small history; the newest row per room is the load target.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yjs_snapshots (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    state       BYTEA       NOT NULL,                   -- Yjs update binary
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast "latest snapshot for room" lookups.
CREATE INDEX IF NOT EXISTS idx_snapshots_room_created
    ON yjs_snapshots(room_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- chat_messages
-- Workspace chat, persisted for history (Phase 4).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id        UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    participant_id UUID        REFERENCES participants(id) ON DELETE SET NULL,
    author_name    TEXT        NOT NULL,                -- denormalized for history
    body           TEXT        NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_room_created
    ON chat_messages(room_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- activity_events
-- Append-only feed powering the activity dashboard/timeline (Phase 3).
-- type: 'join' | 'leave' | 'file_open' | 'edit' | 'chat'
-- payload holds type-specific detail (e.g. { "file": "src/app.ts" }).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id        UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    participant_id UUID        REFERENCES participants(id) ON DELETE SET NULL,
    actor_name     TEXT        NOT NULL,                -- denormalized for history
    type           TEXT        NOT NULL,
    payload        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_room_created
    ON activity_events(room_id, created_at DESC);

COMMIT;
