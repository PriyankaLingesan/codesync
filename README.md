# CodeSync

> Google Docs–style **real-time collaborative coding** inside VS Code.
> Shared rooms, live cursors, presence, chat, and a live codebase graph.

CodeSync is a VS Code extension backed by a lightweight Node collaboration
server. Multiple developers join a room, open the same files, and see each
other's edits, cursors, selections, and activity in real time — powered by the
[Yjs](https://yjs.dev) CRDT.

Built as a portfolio project: realistic and demo-ready, deliberately free of
enterprise complexity (no Kubernetes, microservices, or multi-region infra).

## Features
- **Real-time multi-user editing** with conflict-free sync (Yjs CRDT)
- **Live cursors & selections** — colored, labeled with each collaborator's name
- **Presence** — online collaborators, avatars, active file, typing indicators
- **Activity dashboard** — who's editing what, recent edits, a live timeline
- **Workspace chat** — persisted history + typing indicators
- **Codebase visualization** — a live, force-directed import/dependency graph

## Tech stack
| Layer | Tech |
|---|---|
| Extension | TypeScript, VS Code API, esbuild |
| Webviews | React, Vite |
| Server | Node.js, Fastify, `@fastify/websocket` |
| Sync | Yjs + y-protocols (CRDT + awareness) |
| Storage | PostgreSQL (`pg`) |
| Tests / CI | Vitest, GitHub Actions, Docker |
| Monorepo | npm workspaces |

## Repository layout
```
codesync/
├── docs/                         ARCHITECTURE · DATABASE · WEBSOCKET-PROTOCOL · SETUP · DEMO · DEPLOYMENT
├── docker-compose.yml            production stack (Postgres + server)
├── docker-compose.dev.yml        dev-only Postgres
├── vitest.config.ts              monorepo test config
├── .github/workflows/ci.yml      CI: build + typecheck + tests (with Postgres)
├── .vscode/                      launch.json + tasks.json (F5 to run the extension)
└── packages/
    ├── shared/                   type-safe contracts shared by every package
    │   └── src/                  models · events · protocol · webview
    ├── server/                   Fastify + WebSocket + Yjs + Postgres
    │   ├── src/
    │   │   ├── domain/           Room entity
    │   │   ├── application/      SyncEngine · RoomManager · Activity/Chat services
    │   │   ├── infrastructure/   pg pool + repositories, id/color utils
    │   │   └── interfaces/       REST routes + WebSocket handler
    │   ├── db/schema.sql         Postgres schema
    │   ├── test/                 unit + DB-gated integration tests
    │   └── Dockerfile
    ├── extension/                VS Code extension host
    │   └── src/
    │       ├── net/              HttpClient · ConnectionManager (WS)
    │       ├── collab/           CollaborationSession · DocumentBinding · cursors
    │       ├── webview/          view providers + GraphPanel
    │       ├── analysis/         import graph analyzer (+ pure parsing module)
    │       └── extension.ts      entry point
    └── webview-ui/               React panels (presence · activity · chat · graph)
        └── src/panels/
```
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Quick start
```bash
npm install
npm run build:shared
npm run db:up                                  # Postgres + schema (Docker)
npm run start   --workspace @codesync/server   # server on :4000
npm run build:webviews
npm run build   --workspace codesync-vscode
```
Then open the repo in VS Code and press **F5** to launch the extension, or see
[`docs/SETUP.md`](docs/SETUP.md) for the full walkthrough and
[`docs/DEMO.md`](docs/DEMO.md) for a demo script.

## Testing
```bash
npm test          # unit tests; integration test auto-runs when DATABASE_URL is set
```

## Deployment
```bash
docker compose up --build -d      # Postgres + server
```
Package the extension as a VSIX per [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation
- [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [WebSocket protocol](docs/WEBSOCKET-PROTOCOL.md)
- [Setup](docs/SETUP.md) · [Demo](docs/DEMO.md) · [Deployment](docs/DEPLOYMENT.md)

## License
MIT
