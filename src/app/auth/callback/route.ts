/**
 * GET /auth/callback
 *
 * Handles:
 *   1. Google OAuth callback (code + state params)
 *   2. Password reset token redirect
 *   3. Fallback redirect for already-authenticated users
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSqlAdmin } from '@/lib/db/postgres';
import { createUserSession } from '@/lib/auth/session';

function validateRedirectUrl(url: string): string {
    if (!url.startsWith('/') || url.startsWith('//') || url.includes('://')) return '/';
    return url;
}

function getOrigin(request: Request): string {
    const fwdHost = request.headers.get('x-forwarded-host');
    const fwdProto = request.headers.get('x-forwarded-proto') || 'https';
    if (fwdHost) return `${fwdProto}://${fwdHost}`;
    return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}

// ─── Google token exchange ────────────────────────────────────────────────────

async function exchangeGoogleCode(code: string, redirectUri: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id:     process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri:  redirectUri,
            grant_type:    'authorization_code',
        }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    return res.json() as Promise<{ access_token: string; id_token: string }>;
}

async function getGoogleUser(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`);
    return res.json() as Promise<{
        sub: string;
        email: string;
        name?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
        email_verified?: boolean;
    }>;
}

// ─── User upsert ──────────────────────────────────────────────────────────────

async function findOrCreateGoogleUser(googleUser: {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
}): Promise<string> {
    const sql = getSqlAdmin();

    // Check by email first (may have signed up with email/password before)
    const existing = await sql`
        SELECT id FROM users WHERE email = ${googleUser.email.toLowerCase()} LIMIT 1
    `;

    if (existing.length > 0) {
        // Update avatar if we got one from Google
        if (googleUser.picture) {
            await sql`
                UPDATE users SET avatar_url = ${googleUser.picture}, updated_at = NOW()
                WHERE id = ${existing[0].id} AND (avatar_url IS NULL OR avatar_url = '')
            `;
        }
        return existing[0].id;
    }

    // Create new user — no password_hash (OAuth users authenticate via Google)
    const rows = await sql`
        INSERT INTO users (email, role, first_name, last_name, avatar_url)
        VALUES (
            ${googleUser.email.toLowerCase()},
            'user',
            ${googleUser.given_name ?? null},
            ${googleUser.family_name ?? null},
            ${googleUser.picture ?? null}
        )
        RETURNING id
    `;
    return rows[0].id;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const origin = getOrigin(request);
    const { searchParams } = new URL(request.url);

    // ── Password reset token ────────────────────────────────────────────────
    const resetToken = searchParams.get('token');
    if (resetToken) {
        return NextResponse.redirect(`${origin}/auth/reset-password?token=${resetToken}`);
    }

    // ── Google OAuth callback ───────────────────────────────────────────────
    const code     = searchParams.get('code');
    const state    = searchParams.get('state');
    const oauthErr = searchParams.get('error');

    const cookieStore = await cookies();
    const storedState    = cookieStore.get('oauth_state')?.value;
    const storedProvider = cookieStore.get('oauth_provider')?.value;

    if (code && storedProvider === 'google') {
        // Clear state cookies
        cookieStore.delete('oauth_state');
        cookieStore.delete('oauth_provider');

        if (oauthErr) {
            console.error('[OAuth] Google error:', oauthErr);
            return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
        }

        if (!state || state !== storedState) {
            console.error('[OAuth] State mismatch — possible CSRF');
            return NextResponse.redirect(`${origin}/login?error=oauth_state`);
        }

        try {
            const redirectUri = `${origin}/auth/callback`;
            const tokens      = await exchangeGoogleCode(code, redirectUri);
            const googleUser  = await getGoogleUser(tokens.access_token);

            if (!googleUser.email) {
                return NextResponse.redirect(`${origin}/login?error=oauth_no_email`);
            }

            const userId = await findOrCreateGoogleUser(googleUser);
            await createUserSession(userId);

            return NextResponse.redirect(`${origin}/`);
        } catch (err: any) {
            console.error('[OAuth] Google callback error:', err.message);
            return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
        }
    }

    // ── Fallback: already authenticated ────────────────────────────────────
    const { getSession } = await import('@/lib/auth/session');
    const { user } = await getSession();
    if (user) {
        const target = user.role === 'admin' ? '/admin' : validateRedirectUrl(searchParams.get('next') || '/');
        return NextResponse.redirect(`${origin}${target}`);
    }

    return NextResponse.redirect(`${origin}/login`);
}
