/**
 * Runtime configuration, read from environment variables with sane defaults.
 * Kept tiny and dependency-free — no config framework needed at this scope.
 */
export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  /** Debounce window (ms) before an active room persists a state snapshot. */
  snapshotDebounceMs: number;
}

export function loadConfig(): Config {
  return {
    host: process.env.SERVER_HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? process.env.SERVER_PORT ?? 4000),
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgres://codesync:codesync@localhost:5432/codesync",
    snapshotDebounceMs: Number(process.env.SNAPSHOT_DEBOUNCE_MS ?? 10000)
  };
}
