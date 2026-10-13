import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import {
    BRAND_PREVIEW_COOKIE,
    BRAND_PREVIEW_PARAM,
    BRAND_PREVIEW_RESET,
    brandPreviewEnabled,
    parsePreviewBrand,
} from '@/shared/lib/brand';

const intlMiddleware = createMiddleware(routing);

// api-v2 issues a JWT in this cookie (ADR-0017). v1 guarded on Lucia's
// `cg-session`, which v2 no longer has.
const SESSION_COOKIE = 'access_token';

const BRAND_PREVIEW_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * `?brand_preview=airanggo` on a deployment with the brand preview on: remember the pick in a
 * cookie, then send the visitor to the same page without the parameter so the address they share
 * is the page, not the switch.
 *
 * Returns null — and does nothing — when the preview is off. That is the whole production story:
 * a link carrying the parameter is an ordinary link there.
 */
function brandPreviewResponse(request: NextRequest): NextResponse | null {
    if (!brandPreviewEnabled()) return null;

    const asked = request.nextUrl.searchParams.get(BRAND_PREVIEW_PARAM);
    if (asked === null) return null;

    const clean = request.nextUrl.clone();
    clean.searchParams.delete(BRAND_PREVIEW_PARAM);
    const response = NextResponse.redirect(clean);

    if (asked.trim().toLowerCase() === BRAND_PREVIEW_RESET) {
        response.cookies.delete(BRAND_PREVIEW_COOKIE);
        return response;
    }

    // Only a brand the preview offers is stored. Anything else is dropped from the address and
    // otherwise ignored: the cookie's value ends up in page copy.
    const brand = parsePreviewBrand(asked);
    if (brand) {
        response.cookies.set({
            name:     BRAND_PREVIEW_COOKIE,
            value:    brand,
            path:     '/',
            httpOnly: true,
            sameSite: 'lax',
            secure:   clean.protocol === 'https:',
            maxAge:   BRAND_PREVIEW_MAX_AGE,
        });
    }
    return response;
}

export default function middleware(request: NextRequest) {
    // Before the admin check on purpose: the switch is the same for staff, and a signed-out
    // visitor to /admin is sent on to the login page by the next request, as before.
    const preview = brandPreviewResponse(request);
    if (preview) return preview;

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
