import { Pool, types } from 'pg';
import { config } from './env.js';

export const pool = new Pool({
  ...(config.dbUrl
    ? { connectionString: config.dbUrl }
    : {
        user: config.dbUser,
        host: config.dbHost,
        database: config.dbName,
        password: config.dbPassword,
        port: config.dbPort,
      }),
  ssl: config.dbSsl,
  // Render hands the process to a proxy; the socket can sit idle between users
  // (free tier sleeps after 15 min) and Postgres would otherwise drop it.
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// The app always writes timestamps as UTC ISO strings (new Date().toISOString()),
// and PostgreSQL stores them in `timestamp without time zone` columns as the UTC
// wall clock (the timezone suffix is dropped on insert). node-postgres normally
// interprets such values in the server's local timezone, which shifts every time
// when read back (e.g. 13:35 UTC-wall read as 13:35 PDT -> +7h). Force a UTC
// interpretation so timestamps round-trip to the exact instant they were created.
const TIMESTAMP_OID = 1114; // timestamp (without time zone)
types.setTypeParser(TIMESTAMP_OID, (value: string) => {
  if (value === null || value === undefined) return value;
  // "2026-08-12 13:35:27.086" -> "2026-08-12T13:35:27.086Z"
  return new Date(value.replace(' ', 'T') + 'Z');
});

export async function pingDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}
