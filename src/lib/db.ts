import { Pool, type PoolClient, type QueryResultRow } from "pg";

export type { PoolClient, QueryResultRow };

/**
 * Single shared connection pool for the whole server process.
 *
 * Next.js dev mode re-evaluates modules on every hot reload, so the pool is
 * cached on `globalThis` to avoid exhausting Postgres' connection limit.
 *
 * The pool is created lazily: importing this module must never throw, otherwise
 * `next build` fails on machines that have no DATABASE_URL configured yet.
 */
const globalForPg = globalThis as unknown as { agatiPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your PostgreSQL instance.",
    );
  }

  return new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Local dev over a unix socket / non-SSL localhost needs this off.
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

export function getPool(): Pool {
  // Always cache: in dev this survives hot reloads, in prod it keeps a single
  // pool for the life of the process instead of one per request.
  globalForPg.agatiPool ??= createPool();
  return globalForPg.agatiPool;
}

/** Parameterised query. Never interpolate user input into `text`. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** Run `fn` inside a transaction, rolling back on any throw. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
