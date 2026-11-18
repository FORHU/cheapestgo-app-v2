/**
 * The response headers the staff host carries (ADR-0006: "noindex, HSTS, X-Frame-Options: DENY
 * and a strict CSP"), plus the two the security review asked for beside them.
 *
 * Staff pages show passenger names and card metadata, so this host is held to a stricter policy
 * than the storefront: nothing framed, nothing indexed, no script that Next did not render this
 * request.
 *
 * The CSP is nonce-based. A fresh nonce per request is handed to Next through the request's own
 * `Content-Security-Policy` header, and Next stamps it on every script it renders. That only
 * works for pages rendered per request, which is why the admin layout and the login page opt out
 * of static rendering — a prerendered page carries no nonce and every script on it is blocked.
 * `'strict-dynamic'` then lets those scripts load the chunks they need without listing them.
 *
 * Every origin is `'self'`: on the staff host the API, its support stream included, is reached on
 * this origin (`apiBaseForHost` in env.ts), and the staff screens load no maps, analytics or
 * Stripe.js. Images are the one exception — course and destination photos are pasted URLs on
 * other hosts — and an image cannot run code.
 *
 * Pure, so it can be tested without a request: the middleware decides *when*, this decides *what*.
 */

import { THEME_SCRIPT_SHA256 } from '@/shared/lib/themeScript';

export interface StaffSecurityOptions {
    nonce: string;
    /** Development: React needs eval for its debugging tools, and HMR talks over a websocket. */
    dev?: boolean;
}

export function staffContentSecurityPolicy({ nonce, dev = false }: StaffSecurityOptions): string {
    return [
        "default-src 'self'",
        // The theme script is the root layout's, shared with the storefront, so it is allowed by hash.
        `script-src 'self' 'nonce-${nonce}' 'sha256-${THEME_SCRIPT_SHA256}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
        // React's `style={}` attributes are inline styles; there is no nonce for those.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        // No `upgrade-insecure-requests`: every source is this HTTPS origin and HSTS already forces
        // HTTPS, so it would add nothing — except breaking every asset on a plain-http local build.
    ].join('; ');
}

export function staffSecurityHeaders(options: StaffSecurityOptions): Record<string, string> {
    return {
        'Content-Security-Policy':   staffContentSecurityPolicy(options),
        // A year, and this host's subdomains. Not `preload`: that is a commitment for the whole
        // registrable domain, which the storefront has not made.
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Frame-Options':           'DENY',
        'X-Content-Type-Options':    'nosniff',
        // A staff URL can carry a booking reference or a payment id; nothing leaves in a Referer.
        'Referrer-Policy':           'no-referrer',
        'X-Robots-Tag':              'noindex, nofollow',
    };
}

/** A nonce for one request. Edge-safe: no Node `Buffer`. */
export function newNonce(): string {
    return btoa(crypto.randomUUID());
}
