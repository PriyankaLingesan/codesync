# CodeSync — Local Setup Guide

## Prerequisites
- Node.js 20+ (tested on 20 and 22)
- Docker (for Postgres) — or a local Postgres 14+ if you prefer
- VS Code 1.90+

## 1. Install dependencies
```bash
cd codesync
npm install
```

## 2. Build the shared contracts
Every package depends on `@codesync/shared`, so build it first:
```bash
npm run build:shared
```

## 3. Start Postgres and load the schema
The dev compose file boots Postgres and auto-loads `packages/server/db/schema.sql`:
```bash
cp .env.example .env
npm run db:up      # docker compose -f docker-compose.dev.yml up -d
```
To stop it later: `npm run db:down`.

> No Docker? Create a database named `codesync`, then run the schema manually:
> `psql "$DATABASE_URL" -f packages/server/db/schema.sql`

## 4. Run the collaboration server
```bash
cp packages/server/.env.example packages/server/.env   # optional; defaults work
npm run build --workspace @codesync/server
npm run start --workspace @codesync/server              # http/ws on :4000
```
Verify it's up: `curl http://localhost:4000/health` → `{"status":"ok"}`.

## 5. Build and launch the VS Code extension
```bash
npm run build:webviews                        # bundles the React panels
npm run build --workspace codesync-vscode     # bundles the extension
```
Then, in VS Code:
1. Open the `codesync` folder.
2. Press **F5** (uses `.vscode/launch.json`, which rebuilds first) to open the
   Extension Development Host.
3. In the dev host, open any folder with source files.

## 6. Configure (optional)
Settings → search "CodeSync":
- `codesync.serverUrl` — defaults to `ws://localhost:4000`
- `codesync.displayName` — defaults to your OS username

## Running tests
```bash
npm test                 # unit tests (integration auto-skips without a DB)
# With Postgres running and DATABASE_URL set, the integration test also runs:
DATABASE_URL=postgres://codesync:codesync@localhost:5432/codesync npm test
```

## Common scripts
| Command | What it does |
|---|---|
| `npm run build:shared` | Compile shared types |
| `npm run build:webviews` | Bundle React panels into the extension |
| `npm run build` | Build every package |
| `npm run typecheck` | Typecheck every package |
| `npm test` | Run the test suite |
| `npm run db:up` / `db:down` | Start / stop the dev Postgres |
