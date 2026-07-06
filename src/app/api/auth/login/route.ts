/**
 * POST /api/auth/login
 * Replaces Supabase Auth's /auth/v1/token?grant_type=password
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createUserSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const rl = await rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'auth-login' });
    if (!rl.success) {
        return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
    }

    try {
        const { email, password } = await req.json();

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }

        const user = await verifyPassword(email.trim().toLowerCase(), password);

        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
        }

        if (user.banned_at) {
            return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 });
        }

        await createUserSession(user.id);

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.first_name,
                lastName: user.last_name,
                avatarUrl: user.avatar_url,
            },
        });
    } catch (err: any) {
        console.error('[auth/login]', err);
        return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
    }
}
