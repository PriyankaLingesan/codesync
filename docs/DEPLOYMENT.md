# CodeSync — Deployment Guide

CodeSync has two deployable pieces: the **collaboration server** (a container)
and the **VS Code extension** (a `.vsix` users install). This is a portfolio
project, so deployment is intentionally single-instance and simple.

## Server: Docker Compose (recommended)
The production compose file builds the server image and runs it with Postgres:
```bash
docker compose up --build -d
```
This starts:
- `postgres` — Postgres 16, schema auto-loaded from `packages/server/db/schema.sql`, data in a named volume.
- `server` — the collaboration server on port **4000**, wired to Postgres.

Check health: `curl http://localhost:4000/health`.

Stop / reset:
```bash
docker compose down            # stop
docker compose down -v         # stop and delete the database volume
```

### Configuration
Override via environment (or a `.env` next to the compose file):

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `codesync` | DB credentials |
| `DATABASE_URL` | derived | Server's Postgres connection string |
| `SERVER_PORT` | `4000` | Server listen port |
| `SNAPSHOT_DEBOUNCE_MS` | `10000` | Debounce before persisting a room snapshot |

## Server: manual / single host
```bash
npm install
npm run build:shared
npm run build --workspace @codesync/server
DATABASE_URL=postgres://user:pass@host:5432/codesync \
  node packages/server/dist/main.js
```
Put it behind a reverse proxy (nginx/Caddy) for TLS. For public use, terminate
TLS and point clients at `wss://your-host` via the `codesync.serverUrl` setting.

## Extension: package a VSIX
```bash
npm run build:shared
npm run build:webviews
npm run build --workspace codesync-vscode
npx --yes @vscode/vsce package --no-dependencies
```
This produces `codesync-vscode-0.1.0.vsix`. Install it with
**Extensions → … → Install from VSIX**, or `code --install-extension <file>.vsix`.
Users then set `codesync.serverUrl` to your deployed server.

> `--no-dependencies` is used because the extension is already bundled into a
> single file by esbuild, and the webview assets live in `media/`.

## CI
`.github/workflows/ci.yml` runs on every push/PR: it spins up a Postgres
service, installs deps, builds the shared package, loads the schema, typechecks,
runs the full test suite (unit **and** the DB-backed integration test), then
builds all packages.

## Scaling notes (out of scope, but for discussion)
The server keeps each room's live `Y.Doc` in memory, so it's single-instance by
design. To scale horizontally you'd add Redis pub/sub to fan out Yjs + awareness
updates across instances and share room ownership — deliberately omitted here to
keep the project focused.
