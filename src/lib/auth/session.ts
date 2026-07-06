/**
 * Session management helpers — server-side only.
 *
 * Replaces supabase.auth.getUser() / getSession() calls in:
 *   - src/lib/server/auth.ts
 *   - API routes
 *   - Server components
 */

import { cookies } from 'next/headers';
import { getLucia } from './lucia';
import type { Session, User } from 'lucia';
import { getSqlAdmin } from '@/lib/db/postgres';
import { hash, verify } from '@node-rs/argon2';

// ─── Session resolution ───────────────────────────────────────────────────────

export interface SessionResult {
    session: Session | null;
    user: SessionUser | null;
}

export interface SessionUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    role: 'user' | 'admin';
    bannedAt?: string | null;
}

/**
 * Read and validate the session cookie from the current request.
 * Use in Server Components and API Route Handlers.
 */
export async function getSession(): Promise<SessionResult> {
    const lucia = getLucia();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;

    if (!sessionId) return { session: null, user: null };

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session) return { session: null, user: null };

    // Refresh session cookie if it's close to expiry (sliding window)
    // (This replaces Supabase's automatic token refresh in middleware)
    if (session.fresh) {
        const newCookie = lucia.createSessionCookie(session.id);
        cookieStore.set(newCookie.name, newCookie.value, newCookie.attributes);
    }

    // In Lucia v3, user attributes are merged directly onto the User object
    return {
        session,
        user: {
            id: user.id,
            email: (user as any).email,
            firstName: (user as any).first_name,
            lastName: (user as any).last_name,
            avatarUrl: (user as any).avatar_url,
            role: ((user as any).role ?? 'user') as 'user' | 'admin',
            bannedAt: (user as any).banned_at,
        },
    };
}

/**
 * Create a new session for the user and set the cookie.
 * Call after successful login / signup.
 */
export async function createUserSession(userId: string): Promise<void> {
    const lucia = getLucia();
    const session = await lucia.createSession(userId, {});
    const cookie = lucia.createSessionCookie(session.id);
    const cookieStore = await cookies();
    cookieStore.set(cookie.name, cookie.value, cookie.attributes);
}

/**
 * Invalidate the current session and clear the cookie.
 * Call on logout.
 */
export async function invalidateSession(): Promise<void> {
    const lucia = getLucia();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;

    if (sessionId) {
        await lucia.invalidateSession(sessionId);
    }

    const blankCookie = lucia.createBlankSessionCookie();
    cookieStore.set(blankCookie.name, blankCookie.value, blankCookie.attributes);
}

// ─── User CRUD ────────────────────────────────────────────────────────────────

/**
 * Find a user by email in the users table.
 */
export async function getUserByEmail(email: string) {
    const sql = getSqlAdmin();
    const rows = await sql`
        SELECT id, email, password_hash, role, banned_at, first_name, last_name, avatar_url
        FROM users
        WHERE email = ${email.toLowerCase()}
        LIMIT 1
    `;
    return rows[0] ?? null;
}

/**
 * Create a new user with a hashed password.
 * Also creates the profile row via the trigger.
 */
export async function createUser(params: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
}): Promise<{ id: string }> {
    const sql = getSqlAdmin();
    const passwordHash = await hash(params.password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });

    const rows = await sql`
        INSERT INTO users (email, password_hash, role, first_name, last_name, avatar_url)
        VALUES (
            ${params.email.toLowerCase()},
            ${passwordHash},
            'user',
            ${params.firstName ?? null},
            ${params.lastName ?? null},
            ${params.avatarUrl ?? null}
        )
        RETURNING id
    `;
    return { id: rows[0].id };
}

/**
 * Verify an email/password combination.
 * Returns the user if valid, null if credentials are wrong.
 */
export async function verifyPassword(email: string, password: string) {
    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) return null;

    const valid = await verify(user.password_hash, password);
    return valid ? user : null;
}

/**
 * Update a user's password.
 */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
    const sql = getSqlAdmin();
    const passwordHash = await hash(newPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });
    await sql`
        UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
        WHERE id = ${userId}
    `;
}
