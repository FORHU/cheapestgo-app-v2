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
//
// Two names, because api-v2 issues `__Host-access_token` wherever the cookie is `Secure`
// and the bare name in development, and sessions created before that rename are still in
// browsers under the old one. Presence is all that is checked here either way.
const SESSION_COOKIES = ['__Host-access_token', 'access_token'] as const;

/**
 * The hostname staff work from, when there is one (app-v2 ADR-0006).
 *
 * Unset means the split has not been set up yet, and everything behaves as it did: `/admin`
 * stays reachable on the storefront. That is deliberate — shipping the gate before the proxy
 * exists would make the back office unreachable from anywhere.
 *
 * Empty counts as unset, deliberately. These values arrive as Docker build args, and an
 * argument whose GitHub variable is undefined is passed as an empty string rather than
 * omitted — so `!== undefined` alone would read "not configured" as "configured to match
 * nothing" and 404 the back office on every host at once.
 */
const STAFF_HOST = process.env.NEXT_PUBLIC_STAFF_HOST?.trim().toLowerCase() || undefined;

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
    // The requested hostname, port stripped — `host` carries one in development.
    const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
    const onStaffHost = STAFF_HOST !== undefined && host === STAFF_HOST;

    // /admin sits outside the locale segment: it is staff-facing and English
    // only, so it neither needs a prefix nor should be rewritten into one.
    if (pathname.startsWith('/admin')) {
        // Once a staff host exists, the back office answers only there. Without this the
        // subdomain is cosmetic: two doors into one room, and a network rule in front of
        // one of them proves nothing. 404 rather than a redirect — the storefront should
        // not advertise that there is somewhere else to go.
        if (STAFF_HOST !== undefined && !onStaffHost) {
            return new NextResponse(null, { status: 404 });
        }

        // Presence check only - no verification here. The signature is checked by
        // api-v2 on every admin call, and the role decides authority.
        // This exists to bounce a signed-out visitor to the login page rather
        // than flashing an admin shell that is about to 401.
        if (!SESSION_COOKIES.some(name => request.cookies.has(name))) {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/login';
            loginUrl.search = '';
            return NextResponse.redirect(loginUrl);
        }
        return NextResponse.next();
    }

    // The staff host serves the back office and the door into it, and nothing else. A
    // storefront reachable on two names is two things to keep in step, and the one nobody
    // looks at is where a stale page survives.
    //
    // The login allowance matches the locale prefix too: the sign-in page lives under
    // `[locale]`, so by the time anyone follows a redirect to it the path is `/en/login`,
    // and matching only the bare form would bounce staff between /admin and the login
    // page forever.
    if (onStaffHost && !/^\/([a-z]{2}\/)?login(\/|$)/.test(pathname)) {
        const adminUrl = request.nextUrl.clone();
        adminUrl.pathname = '/admin';
        adminUrl.search = '';
        return NextResponse.redirect(adminUrl);
    }

    return intlMiddleware(request);
}

export const config = {
    // Everything except Next internals, the service worker, and static files.
    // `/admin` is matched on purpose - the handler above deals with it.
    //
    // robots.txt, sitemap.xml and opengraph-image must be excluded explicitly. They are
    // routes, not files on disk, so without this the locale middleware rewrites them
    // into the segment and a crawler asking for /robots.txt is handed the
    // rendered homepage instead. `opengraph-image` fails the same way and more quietly:
    // a scraper asking for the card gets 145KB of HTML and a 404, and nothing on the site
    // looks broken to anyone who is not sharing a link.
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|opengraph-image|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|txt|xml|woff2?)$).*)',
    ],
};
