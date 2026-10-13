import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// api-v2 issues a JWT in this cookie (ADR-0017). v1 guarded on Lucia's
// `cg-session`, which v2 no longer has.
const SESSION_COOKIE = 'access_token';

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // /admin sits outside the locale segment: it is staff-facing and English
    // only, so it neither needs a prefix nor should be rewritten into one.
    if (pathname.startsWith('/admin')) {
        // Presence check only - no verification here. The signature is checked by
        // api-v2 on every admin call, and requireRole('admin') decides authority.
        // This exists to bounce a signed-out visitor to the login page rather
        // than flashing an admin shell that is about to 401.
        if (!request.cookies.has(SESSION_COOKIE)) {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/login';
            loginUrl.search = '';
            return NextResponse.redirect(loginUrl);
        }
        return NextResponse.next();
    }

    return intlMiddleware(request);
}

export const config = {
    // Everything except Next internals, the service worker, and static files.
    // `/admin` is matched on purpose - the handler above deals with it.
    //
    // robots.txt and sitemap.xml must be excluded explicitly. They are routes,
    // not files on disk, so without this the locale middleware rewrites them
    // into the segment and a crawler asking for /robots.txt is handed the
    // rendered homepage instead.
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|txt|xml|woff2?)$).*)',
    ],
};
