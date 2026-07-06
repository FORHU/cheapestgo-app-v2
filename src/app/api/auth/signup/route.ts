/**
 * POST /api/auth/signup
 * Replaces Supabase Auth's /auth/v1/signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, createUserSession, getUserByEmail } from '@/lib/auth/session';
import { rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const rl = await rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'auth-signup' });
    if (!rl.success) {
        return NextResponse.json({ error: 'Too many signup attempts.' }, { status: 429 });
    }

    try {
        const { email, password, firstName, lastName } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
        }

        const existing = await getUserByEmail(email.trim().toLowerCase());
        if (existing) {
            return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
        }

        const { id } = await createUser({
            email: email.trim().toLowerCase(),
            password,
            firstName,
            lastName,
        });

        await createUserSession(id);

        return NextResponse.json({ user: { id, email } }, { status: 201 });
    } catch (err: any) {
        console.error('[auth/signup]', err);
        return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 });
    }
}
