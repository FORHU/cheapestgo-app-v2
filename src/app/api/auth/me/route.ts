/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 * Replaces supabase.auth.getUser() calls in client components.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { user } = await getSession();
    if (!user) {
        return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user });
}
