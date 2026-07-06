/**
 * POST /api/auth/logout
 * Replaces Supabase Auth's /auth/v1/logout
 */

import { NextResponse } from 'next/server';
import { invalidateSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        await invalidateSession();
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[auth/logout]', err);
        return NextResponse.json({ error: 'Logout failed.' }, { status: 500 });
    }
}
