import pg from "pg";

/** Create a shared Postgres connection pool from a connection string. */
export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

export type { Pool } from "pg";
