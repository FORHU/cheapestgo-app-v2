/**
 * Next.js edge middleware.
 * Runs on every matched request before the page/route handler.
 *
 * Validates the Lucia session cookie on every request.
 * Refreshes the cookie if the session is still valid (sliding expiry).
 * Redirects unauthenticated users away from protected routes.
 */

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware';

export async function middleware(request: NextRequest) {
    return updateSession(request);
}

export const config = {
    runtime: 'nodejs',
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};