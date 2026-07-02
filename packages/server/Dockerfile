# Multi-stage build for the CodeSync collaboration server.
# Build context is the monorepo root (see docker-compose.yml).

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests + sources needed to build shared + server.
COPY package.json tsconfig.base.json ./
COPY packages ./packages

# Install only the shared + server workspaces (skips extension/webview deps).
RUN npm install -w @codesync/shared -w @codesync/server --no-audit --no-fund

RUN npm run build --workspace @codesync/shared \
 && npm run build --workspace @codesync/server

# ---- runtime stage ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# Copy the built app (node_modules include the @codesync/shared workspace link).
COPY --from=build /app ./

EXPOSE 4000
CMD ["node", "packages/server/dist/main.js"]
