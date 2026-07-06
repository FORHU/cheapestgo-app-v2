/**
 * Lucia v3 auth configuration.
 *
 * Replaces Supabase Auth. Uses our PostgreSQL database for:
 *   - users table  (replaces auth.users)
 *   - sessions table (managed by Lucia)
 *
 * Session cookies: sb-session (same name convention, or configure below)
 */

import { Lucia } from 'lucia';
import { getSqlAdmin } from '@/lib/db/postgres';

// ─── Custom PostgreSQL adapter for postgres.js ────────────────────────────────
// Lucia v3 ships adapters for common ORMs. For raw postgres.js we implement
// the DatabaseAdapter interface directly.

import type { Adapter, DatabaseSession, DatabaseUser, UserId } from 'lucia';

class PostgresJsAdapter implements Adapter {
    private get sql() { return getSqlAdmin(); }

    async getSessionAndUser(sessionId: string): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
        const rows = await this.sql`
            SELECT
                s.id           AS session_id,
                s.user_id,
                s.expires_at,
                s.attributes   AS session_attrs,
                u.id           AS user_id,
                u.email,
                u.first_name,
                u.last_name,
                u.avatar_url,
                u.role,
                u.banned_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = ${sessionId}
        `;
        if (rows.length === 0) return [null, null];
        const r = rows[0];
        const session: DatabaseSession = {
            id: r.session_id,
            userId: r.user_id,
            expiresAt: new Date(r.expires_at),
            attributes: r.session_attrs ?? {},
        };
        const user: DatabaseUser = {
            id: r.user_id,
            attributes: {
                email: r.email,
                first_name: r.first_name,
                last_name: r.last_name,
                avatar_url: r.avatar_url,
                role: r.role,
                banned_at: r.banned_at,
            },
        };
        return [session, user];
    }

    async getUserSessions(userId: UserId): Promise<DatabaseSession[]> {
        const rows = await this.sql`
            SELECT id, user_id, expires_at, attributes
            FROM sessions
            WHERE user_id = ${userId}
        `;
        return rows.map((r) => ({
            id: r.id,
            userId: r.user_id,
            expiresAt: new Date(r.expires_at),
            attributes: r.attributes ?? {},
        }));
    }

    async setSession(session: DatabaseSession): Promise<void> {
        await this.sql`
            INSERT INTO sessions (id, user_id, expires_at, attributes)
            VALUES (${session.id}, ${session.userId}, ${session.expiresAt}, ${JSON.stringify(session.attributes)})
            ON CONFLICT (id) DO UPDATE
            SET expires_at = EXCLUDED.expires_at,
                attributes = EXCLUDED.attributes
        `;
    }

    async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
        await this.sql`
            UPDATE sessions SET expires_at = ${expiresAt} WHERE id = ${sessionId}
        `;
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.sql`DELETE FROM sessions WHERE id = ${sessionId}`;
    }

    async deleteUserSessions(userId: UserId): Promise<void> {
        await this.sql`DELETE FROM sessions WHERE user_id = ${userId}`;
    }

    async deleteExpiredSessions(): Promise<void> {
        await this.sql`DELETE FROM sessions WHERE expires_at < NOW()`;
    }
}

// ─── Lucia instance ───────────────────────────────────────────────────────────

let _lucia: Lucia | null = null;

export function getLucia(): Lucia {
    if (!_lucia) {
        _lucia = new Lucia(new PostgresJsAdapter(), {
            sessionCookie: {
                name: 'cg-session',
                attributes: {
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                },
            },
            getUserAttributes(attrs: Record<string, unknown>) {
                return {
                    email: attrs.email as string,
                    firstName: attrs.first_name as string | undefined,
                    lastName: attrs.last_name as string | undefined,
                    avatarUrl: attrs.avatar_url as string | undefined,
                    role: attrs.role as 'user' | 'admin',
                    bannedAt: attrs.banned_at as string | null,
                };
            },
            getSessionAttributes(_attrs: Record<string, unknown>) {
                return {};
            },
        });
    }
    return _lucia;
}

// Export type helpers
export type Auth = ReturnType<typeof getLucia>;
export type Session = ReturnType<Auth['validateSession']> extends Promise<{ session: infer S | null }> ? S : never;

// Declare module augmentation for Lucia types
declare module 'lucia' {
    interface Register {
        Lucia: ReturnType<typeof getLucia>;
        DatabaseUserAttributes: {
            email: string;
            first_name?: string;
            last_name?: string;
            avatar_url?: string;
            role: 'user' | 'admin';
            banned_at?: string | null;
        };
    }
}
