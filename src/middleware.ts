import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import {
    BRAND_PREVIEW_COOKIE,
    BRAND_PREVIEW_PARAM,
    BRAND_PREVIEW_RESET,
    DEPLOYMENT_BRAND_NAME,
    brandPreviewEnabled,
    parsePreviewBrand,
    resolveBrandName,
} from '@/shared/lib/brand';
import { newNonce, staffSecurityHeaders } from '@/shared/lib/staffSecurityHeaders';

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
 * next-intl's own cookie for a language the visitor picked. Its default name: `routing.ts` does
 * not rename it. The language menu writes it on every switch, English included.
 */
const LOCALE_COOKIE = 'NEXT_LOCALE';

/** `/ja/hotels` → `/hotels`, `/ko` → `/`; an unprefixed path is returned as it is. */
function withoutLocalePrefix(pathname: string): string {
    const prefix = routing.locales.find((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
    return prefix ? pathname.slice(prefix.length + 1) || '/' : pathname;
}

/**
 * `?brand_preview=airanggo` on a deployment with the brand preview on: remember the pick in a
 * cookie, then send the visitor to the same page without the parameter so the address they share
 * is the page, not the switch.
 *
 * The page, but in the picked brand's own language: the locale prefix and any language picked
 * from the menu are dropped with the old brand. AirangGo opens in Korean and CheapestGo in
 * English, and either choice made under the other brand would otherwise hold the new one in it.
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

    const reset = asked.trim().toLowerCase() === BRAND_PREVIEW_RESET;
    // Only a brand the preview offers is stored. Anything else is dropped from the address and
    // otherwise ignored: the cookie's value ends up in page copy.
    const brand = reset ? null : parsePreviewBrand(asked);
    if (!reset && !brand) return NextResponse.redirect(clean);

    clean.pathname = withoutLocalePrefix(clean.pathname);
    const response = NextResponse.redirect(clean);
    // On `/`, where next-intl sets it: a delete on any other path leaves the visitor's copy.
    response.cookies.delete({ name: LOCALE_COOKIE, path: '/' });

    if (reset) {
        response.cookies.delete(BRAND_PREVIEW_COOKIE);
    } else if (brand) {
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

/** The language AirangGo opens in. */
const AIRANGGO_LOCALE = 'ko';

/**
 * AirangGo is the Korean brand, so it opens in Korean: an unprefixed — English — page is sent on
 * to the same page under `/ko`.
 *
 * A default, not a lock. Once the visitor picks a language from the menu, next-intl's cookie
 * carries it and the unprefixed address is English for them, as on CheapestGo. `Accept-Language`
 * does not outrank Korean here, though next-intl would otherwise consult it: the production
 * AirangGo build is Korean whatever the browser asks for, and the preview should look like it.
 *
 * Nothing to do on a build locked to one language (`NEXT_PUBLIC_LOCALE`): every unprefixed page is
 * already in it and is the canonical address (seo.ts), so a `/ko` there would be a second one.
 */
function koreanByDefaultResponse(request: NextRequest): NextResponse | null {
    if (process.env.NEXT_PUBLIC_LOCALE?.trim()) return null;
    if (request.cookies.has(LOCALE_COOKIE)) return null;

    const { pathname } = request.nextUrl;
    // Pages only: `/api/og` is an image route, outside the locale segment.
    if (pathname.startsWith('/api/') || withoutLocalePrefix(pathname) !== pathname) return null;

    // Resolved as `getBrandName()` resolves it, so this agrees with the header the page renders.
    const brand = resolveBrandName({
        deployment: DEPLOYMENT_BRAND_NAME,
        enabled:    brandPreviewEnabled(),
        cookie:     request.cookies.get(BRAND_PREVIEW_COOKIE)?.value,
        host:       request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    });
    if (brand !== 'AirangGo') return null;

    const korean = request.nextUrl.clone();
    korean.pathname = `/${AIRANGGO_LOCALE}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(korean);
}

/**
 * The staff host's security headers for one request (ADR-0006), or null off the staff host.
 *
 * `requestHeaders` carries the CSP *into* the render: Next reads the nonce from the request's
 * `Content-Security-Policy` header and stamps it on the scripts it renders. `apply` puts the same
 * headers on whatever this middleware answers — page, redirect or not-found alike, so no response
 * from this host leaves without them.
 */
function staffSecurity(request: NextRequest) {
    const headers = staffSecurityHeaders({ nonce: newNonce(), dev: process.env.NODE_ENV !== 'production' });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy']);
    return {
        requestHeaders,
        apply(response: NextResponse): NextResponse {
            for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
            return response;
        },
    };
}

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    // The requested hostname, port stripped — `host` carries one in development.
    const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
    const onStaffHost = STAFF_HOST !== undefined && host === STAFF_HOST;
    const staff = onStaffHost ? staffSecurity(request) : null;
    const done = (response: NextResponse) => (staff ? staff.apply(response) : response);

    // Before the admin check on purpose: the switch is the same for staff, and a signed-out
    // visitor to /admin is sent on to the login page by the next request, as before.
    const preview = brandPreviewResponse(request);
    if (preview) return done(preview);

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
            return done(NextResponse.redirect(loginUrl));
        }
        return staff
            ? done(NextResponse.next({ request: { headers: staff.requestHeaders } }))
            : NextResponse.next();
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
        return done(NextResponse.redirect(adminUrl));
    }

    // Not on the staff host: the door into the back office stays in the back office's English.
    if (!onStaffHost) {
        const korean = koreanByDefaultResponse(request);
        if (korean) return korean;
    }

    // The staff host's sign-in page. next-intl forwards the headers of the request it is given into
    // the render, so it is handed one carrying the CSP. Built from the URL and headers only, never
    // the original request: copying a request moves its body, and a sign-in POST needs that body.
    if (staff) {
        return done(intlMiddleware(new NextRequest(request.url, { headers: staff.requestHeaders })));
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
