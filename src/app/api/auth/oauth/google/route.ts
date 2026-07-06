/**
 * GET /api/auth/oauth/google
 * Initiates Google OAuth flow — generates state, stores in cookie, redirects to Google.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 });
    }

    // State prevents CSRF
    const state = crypto.randomUUID();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUri = `${siteUrl}/auth/callback`;

    const params = new URLSearchParams({
        client_id:     clientId,
        redirect_uri:  redirectUri,
        response_type: 'code',
        scope:         'openid email profile',
        state,
        access_type:   'offline',
        prompt:        'select_account',
    });

    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   600, // 10 minutes
        path:     '/',
    });
    cookieStore.set('oauth_provider', 'google', {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   600,
        path:     '/',
    });

    return NextResponse.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
}
