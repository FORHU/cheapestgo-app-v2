/**
 * Next.js request middleware — lightweight cookie check + route protection.
 *
 * This runs in the Edge runtime which does NOT support Node.js modules
 * like postgres.js. So we only check if the session cookie exists —
 * no database calls. Actual session validation happens in getSession()
 * inside API routes and server components (full Node.js runtime).
 */

import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'cg-session';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
    const response = NextResponse.next({ request });
    const hasSession = !!request.cookies.get(SESSION_COOKIE_NAME)?.value;

    // Protect /admin routes — redirect to login if no session cookie
    if (request.nextUrl.pathname.startsWith('/admin') && !hasSession) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}