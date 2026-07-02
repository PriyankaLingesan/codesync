# CodeSync — Architecture & Project Setup

> Phase 0 deliverable. This document defines the system architecture, monorepo
> layout, package/TypeScript setup, database design, and the WebSocket event
> contract. **No feature implementation is included yet** — only the skeleton,
> configuration, shared type contracts, and design docs. Implementation begins
> after approval, one phase at a time.

---

## 1. What CodeSync is

CodeSync is a VS Code extension that gives a small team a **Google Docs–style
collaborative coding experience**. Multiple developers join a shared *room*,
open the same files, and see each other's edits, cursors, selections, presence,
and activity in real time. It also adds a workspace chat and a live codebase
dependency/import graph.

The design goal is **portfolio quality**: realistic, impressive, fully
functional, and demo-ready — without enterprise complexity. It is intentionally
a single-server system with a single Postgres database. No Kubernetes, no
microservices, no Redis (unless a later phase proves it is genuinely required).

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Developer's machine                           │
│                                                                        │
│  ┌───────────────────────────── VS Code ─────────────────────────────┐│
│  │                                                                    ││
│  │   Extension Host (Node) ......... packages/extension               ││
│  │   ├── commands (create/join room)                                  ││
│  │   ├── WebSocketConnectionManager  ── binds a Yjs doc per room      ││
│  │   ├── TextDocument  <->  Y.Text    binding (editor sync)           ││
│  │   ├── awareness  ── local cursor / selection / active file         ││
│  │   └── decorations ── remote cursors, selections, name labels       ││
│  │                                                                    ││
│  │   Webview panels (Chromium) ..... packages/webview-ui (React)      ││
│  │   ├── Presence / Online users panel                                ││
│  │   ├── Activity dashboard & timeline                                ││
│  │   ├── Chat sidebar                                                 ││
│  │   └── Dependency / import graph                                    ││
│  └────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────┬────────────────────────────────────┘
                                     │  WebSocket (ws://.../rooms/:id)
                                     │  + REST (create/join, history)
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CodeSync server  (packages/server)                 │
│                                                                        │
│   Fastify HTTP  ── REST: POST /rooms, POST /rooms/:id/join, history    │
│   @fastify/websocket ── one WS route per room                          │
│                                                                        │
│   RoomManager (in memory)                                              │
│   ├── Room  ──> Y.Doc (authoritative live state)                       │
│   │            ├── awareness (presence: cursors, selections, file)     │
│   │            └── connected clients                                   │
│   └── snapshot scheduler (debounced + on-empty)                        │
│                                                                        │
│   Persistence layer (pg)                                               │
│   └── rooms, participants, yjs_snapshots, chat_messages, activity      │
└───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │       PostgreSQL         │
                        │  metadata • snapshots •  │
                        │  chat • activity feed    │
                        └─────────────────────────┘
```

### Shared contracts
`packages/shared` holds the TypeScript types used by **both** the server and the
extension/webview: the WebSocket message protocol, domain models, and event
names. This keeps client and server in lockstep and is compiled once, imported
everywhere.

---

## 3. Core design decisions

| Decision | Choice | Why |
|---|---|---|
| Conflict-free editing | **Yjs** CRDT | Battle-tested, offline-tolerant, no operational-transform server logic to maintain. |
| Authoritative state | **Server-held `Y.Doc` per room, in memory** | Server is the sync hub; clients converge to it. |
| Durability | **Postgres snapshots** of the Yjs update binary (debounced + when the last client leaves) | Rooms survive restarts and empty periods without needing Redis. |
| Presence | **Yjs `awareness`** protocol | Purpose-built for cursors/selections/status; ephemeral, auto-expiring. |
| Identity | **Display name + shareable room code** | Google-Docs "anyone with the link" feel; no OAuth complexity. |
| Transport | **WebSocket** for realtime, **REST** for lifecycle/history | WS for hot path, REST for create/join and paginated history. |
| Scale-out | **None (single instance)** | Portfolio scope. Redis pub/sub is documented as the *future* seam but not built. |

### Why room code instead of auth
A room is created server-side and returns a short opaque `roomCode` (e.g.
`indigo-otter-42`). Anyone with the code can join by choosing a display name.
Each participant is assigned a stable `participantId` and a deterministic color.
This is simple to demo, and mirrors how real collaborative tools onboard guests.

### Persistence model (in-memory + snapshots)
1. On first join to a room, the server loads the latest `yjs_snapshots` row and
   applies it to a fresh `Y.Doc`. If none exists, it starts empty.
2. While clients are connected, all updates flow through the live `Y.Doc`; the
   server relays updates and broadcasts them to peers.
3. A **debounced snapshot** (e.g. every ~10s of activity) and an **on-last-leave
   snapshot** persist `Y.encodeStateAsUpdate(doc)` to Postgres.
4. Awareness (presence) is **never persisted** — it is ephemeral by design.

---

## 4. Monorepo structure

npm **workspaces** (built into npm 7+, already installed — no extra tooling like
Turborepo or Lerna, keeping the setup minimal and legible).

```
codesync/
├── package.json                 # root: workspaces, shared scripts
├── tsconfig.base.json           # shared compiler options (extended by each pkg)
├── .gitignore
├── .env.example                 # top-level env template
├── docker-compose.dev.yml       # dev-only Postgres (so the schema can be run/tested)
├── README.md
│
├── docs/
│   ├── ARCHITECTURE.md          # this file
│   ├── DATABASE.md              # schema rationale + ER description
│   └── WEBSOCKET-PROTOCOL.md    # full event contract
│
└── packages/
    ├── shared/                  # types shared by server + client (no runtime logic)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts         # barrel export
    │       ├── models.ts        # domain models (Room, Participant, ChatMessage…)
    │       ├── events.ts        # event-name enums / string-literal unions
    │       └── protocol.ts      # WS message envelopes (client↔server)
    │
    ├── server/                  # Fastify + WS + Yjs + Postgres  (Phase 1+)
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   └── db/
    │       └── schema.sql       # Postgres DDL (design deliverable)
    │
    ├── extension/               # VS Code extension host  (Phase 1+)
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── webview-ui/              # React webviews (presence, chat, activity, graph)
        ├── package.json
        ├── tsconfig.json
        └── vite.config.ts
```

> In Phase 0 the `server`, `extension`, and `webview-ui` packages contain only
> their **setup** (manifest + tsconfig, plus the DB schema which is a design
> deliverable). Their `src/` trees are populated in later phases.

---

## 5. Package responsibilities

**`@codesync/shared`** — Pure type definitions. Zero runtime dependencies. Both
sides depend on it so the wire protocol can never drift between client and
server. Compiled to `dist/` with declaration files.

**`@codesync/server`** — Fastify HTTP + `@fastify/websocket`. Owns `RoomManager`,
the per-room `Y.Doc`, awareness relay, the snapshot scheduler, and the Postgres
persistence layer. Clean-architecture split (Phase 1): `domain/` (Room,
entities), `application/` (RoomManager, SyncEngine, services), `infrastructure/`
(pg repositories, Fastify/WS wiring), `interfaces/` (routes, socket handlers).

**`@codesync/extension`** — The VS Code extension host. Registers commands,
manages the WebSocket connection, binds `vscode.TextDocument` ⇄ `Y.Text`, renders
remote cursors/selections via editor decorations, and hosts the React webviews.

**`@codesync/webview-ui`** — React apps bundled by Vite into static assets loaded
into VS Code webviews. Communicates with the extension host via
`postMessage`. Renders presence, activity, chat, and the graph.

---

## 6. Data flow: an edit round-trip

1. User types in an editor. The extension's document binding converts the VS
   Code change into a `Y.Text` mutation on the local `Y.Doc`.
2. Yjs emits an incremental update. The connection manager sends it over the WS
   as a `SYNC_UPDATE` message (binary Yjs update).
3. Server applies the update to the room's authoritative `Y.Doc` and broadcasts
   it to every *other* connected client in the room.
4. Each peer applies the update to its local `Y.Doc`; the document binding
   reflects the change into the VS Code editor.
5. Independently, the local cursor/selection/active-file is written to
   **awareness** and broadcast, letting peers draw remote cursors and update the
   presence panel.
6. The server's snapshot scheduler periodically persists the room state.

---

## 7. Non-goals (explicitly out of scope)

Kubernetes, microservices, Helm, multi-region / multi-cloud, high-availability,
voice/video/screen-share, and complex OAuth providers are **not** part of this
project. Redis is not used unless a later phase demonstrates a concrete need.

---

## 8. Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| **0** | Architecture, monorepo, setup, DB design, WS contract | ← this deliverable |
| **1** | Core collaboration: server, WS, Yjs sync, rooms, cursors, selections | pending approval |
| **2** | Presence: online panel, avatars, active file, typing, status | pending |
| **3** | Activity dashboard: who-edits-what, recent edits, timeline, feed | pending |
| **4** | Chat: workspace chat, typing indicators, message history | pending |
| **5** | Visualization: dependency graph, import graph | pending |
| **6** | Testing & deployment: unit/integration tests, Docker, GitHub Actions | pending |

Each phase ends with: folder structure, complete code files, run instructions,
test instructions — then waits for approval.
