import { z } from 'zod';

const schema = z.object({
    NEXT_PUBLIC_API_URL:                    z.string().url(),
    NEXT_PUBLIC_SITE_URL:                   z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:     z.string().min(1),
    NEXT_PUBLIC_MAPBOX_TOKEN:               z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN:                 z.string().optional(),
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:   z.string().optional(),
});

/**
 * The API base this host should use, given where the page is being viewed.
 *
 * One build serves both the storefront and the staff host (see `src/middleware.ts`), so a
 * single baked `NEXT_PUBLIC_API_URL` cannot be right for both: it names the storefront, which
 * means a browser on the staff host signs in through the storefront's origin and the session
 * cookie is set there. `__Host-` forbids a `Domain` attribute — deliberately, api-v2
 * `lib/auth/cookie.ts` calls it the guarantee the staff host rests on — so that cookie is
 * host-scoped to the storefront and the staff host's own middleware can never see it. `/admin`
 * then redirects to `/login` forever. The same mismatch decides OAuth: api-v2 reads the Host
 * header to know which origin to hand the session back to (`lib/auth/returnOrigin.ts`).
 *
 * So on the staff host the API is reached on this origin instead. The path comes from the
 * configured URL rather than being written out again, and nginx already proxies it on both
 * hosts.
 *
 * Only the staff host is rewritten. The storefront, the brand hosts, a container answering on
 * its own port and local development against the API on 4000 all keep the absolute URL —
 * nothing in front of those necessarily proxies `/api/v2`, and an empty `staffHost` (an unset
 * GitHub variable arrives as an empty build arg, not an absent one) means no staff host exists.
 */
export function apiBaseForHost(
    apiUrl: string,
    hostname: string | null,
    staffHost: string | null | undefined,
): string {
    const staff = staffHost?.trim().toLowerCase();
    if (!staff || !hostname || hostname.trim().toLowerCase() !== staff) return apiUrl;
    try {
        // `/api/v2`, so callers that append a path stay same-origin. A trailing slash is
        // dropped because every call site writes its own leading one.
        return new URL(apiUrl).pathname.replace(/[/]+$/, '');
    } catch {
        return apiUrl;
    }
}

const parsed = schema.parse({
    NEXT_PUBLIC_API_URL:                    process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL:                   process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:     process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_MAPBOX_TOKEN:               process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN:                 process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:   process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
});


export const env = {
    ...parsed,
    // Resolved once, when this module is first evaluated — on the server during a render, and
    // again in the browser, which is where the host is actually known.
    NEXT_PUBLIC_API_URL: apiBaseForHost(
        parsed.NEXT_PUBLIC_API_URL,
        typeof window === 'undefined' ? null : window.location.hostname,
        process.env.NEXT_PUBLIC_STAFF_HOST,
    ),
};
