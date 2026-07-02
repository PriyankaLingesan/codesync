# CodeSync — WebSocket & REST Protocol

The realtime contract between the extension/webview clients and the server.
All types are defined once in
[`packages/shared/src`](../packages/shared/src) and imported by both sides, so
the wire format can never drift.

## Channels

- **REST** (Fastify HTTP) — room lifecycle and paginated history:
  - `POST /rooms` → create a room, returns `{ roomId, roomCode, name }`.
  - `POST /rooms/:roomCode/join` → validate a code before opening the socket.
  - `GET  /rooms/:roomCode/chat?before=&limit=` → chat history (Phase 4).
  - `GET  /rooms/:roomCode/activity?before=&limit=` → activity feed (Phase 3).
- **WebSocket** — `GET /rooms/:roomCode/ws` — the realtime hot path (sync,
  presence, chat, activity broadcast).

## Frame format

Every WS frame is a JSON object:

```json
{ "type": "<event-name>", "payload": { ... } }
```

`type` is one of the constants in `events.ts` (`ClientEvent` / `ServerEvent`).
Binary Yjs data (document updates and awareness) is **base64-encoded** and
carried as a string field, so every frame is a single JSON text frame — easy to
inspect and log, and fine for portfolio scale. (Raw binary frames are a
documented future optimization, not needed now.)

## Handshake

```
client                          server
  │  connect  GET /rooms/:code/ws │
  │──────────────────────────────►│
  │  client:join {code, name}     │
  │──────────────────────────────►│  create/assign Participant,
  │                               │  load latest snapshot into Y.Doc
  │  server:welcome               │
  │   { participant,              │
  │     initialState(base64),     │
  │◄──────────────────────────────│     presence[] }
  │                               │  broadcast server:presence_list to peers
```

## Client → Server events

| `type` | payload | meaning |
|---|---|---|
| `client:join` | `{ roomCode, displayName }` | Identify the joining participant (first frame). |
| `client:sync_update` | `{ update: base64 }` | Incremental Yjs document update from the local edit. |
| `client:awareness_update` | `{ update: base64 }` | Awareness update: cursor, selection, active file, typing. |
| `client:chat_send` | `{ body }` | Send a chat message (Phase 4). |
| `client:ping` | `{}` | Keep-alive. |

## Server → Client events

| `type` | payload | meaning |
|---|---|---|
| `server:welcome` | `{ participant, initialState, presence[] }` | Post-join bootstrap. |
| `server:sync_update` | `{ update: base64, from }` | Relayed peer document update. |
| `server:awareness_update` | `{ update: base64 }` | Relayed peer presence update. |
| `server:presence_list` | `{ presence[] }` | Roster changed (join/leave). |
| `server:chat_message` | `{ message }` | New chat message (Phase 4). |
| `server:activity` | `{ event }` | New activity-feed entry (Phase 3). |
| `server:pong` | `{}` | Keep-alive reply. |
| `server:error` | `{ code, message }` | Recoverable error. |

## Synchronization semantics

- The server holds the **authoritative `Y.Doc`** per room. On `client:sync_update`
  it applies the update, then **broadcasts to every other client** (never echoes
  to the sender — Yjs is idempotent, but this avoids needless traffic).
- Because Yjs is a CRDT, updates are **commutative and idempotent**: order of
  delivery does not affect the converged state, so no server-side OT or locking
  is required.
- **Awareness** uses `y-protocols/awareness`. It is relayed but **never
  persisted**; disconnect clears a client's awareness state automatically.
- **Attribution** (`from`) lets clients label whose change/cursor is whose and
  feed the activity timeline.

## Presence model

Presence (`Presence` in `models.ts`) is derived from awareness state and
includes `status` (`active`/`idle`/`offline`), `activeFile`, `typing`, and
`cursor` (`CursorState` with anchor/head `DocPosition`s). The online-users panel
and typing indicators (Phase 2) render directly from this.

## Error handling

Recoverable problems (bad room code, malformed frame) return `server:error`
with a stable `code`. Fatal conditions close the socket with a WS close code.
Clients reconnect with backoff and replay `client:join`; Yjs then re-syncs any
missed updates from the server's authoritative state.
