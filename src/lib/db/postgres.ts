/**
 * Core PostgreSQL connection pool using postgres.js.
 *
 * There is no Row Level Security — the database has no RLS policies and is
 * not publicly reachable. Access control is enforced at the API layer: every
 * route validates the session before querying. sql and sqlAdmin are both
 * full-access connections; sqlAdmin exists only as a separate pool for
 * admin/service-style operations, not as a privilege boundary.
 *
 * DATABASE_URL format:
 *   postgresql://user:password@host:5432/database?sslmode=require
 *
 * Set DATABASE_URL and DATABASE_URL_UNPOOLED in env (unpooled for migrations).
 */

import postgres from 'postgres';

// Lazy singleton — one pool per process
let _sql: postgres.Sql | null = null;
let _sqlAdmin: postgres.Sql | null = null;

function getConnectionString(pooled = true): string {
    const url = pooled
        ? process.env.DATABASE_URL
        : process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

    if (!url) {
        throw new Error(
            'DATABASE_URL is not set. Add it to your environment variables.\n' +
            'Format: postgresql://user:password@host:5432/database'
        );
    }
    return url;
}

/** Standard connection pool used by API routes and server components. */
export function getSql(): postgres.Sql {
    if (!_sql) {
        _sql = postgres(getConnectionString(), {
            max: 10,
            idle_timeout: 30,
            connect_timeout: 10,
            ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
            onnotice: () => {}, // suppress NOTICE messages
        });
    }
    return _sql;
}

/** Admin connection — bypasses RLS for service-role operations */
export function getSqlAdmin(): postgres.Sql {
    if (!_sqlAdmin) {
        _sqlAdmin = postgres(getConnectionString(), {
            max: 5,
            idle_timeout: 30,
            connect_timeout: 10,
            ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
            onnotice: () => {},
        });
    }
    return _sqlAdmin;
}

/**
 * Execute a raw SQL tagged template — use for migrations and one-offs.
 *
 * @example
 *   const rows = await query`SELECT * FROM profiles WHERE id = ${userId}`;
 */
export const query = getSql;

export type Sql = postgres.Sql;
export type Row = postgres.Row;
