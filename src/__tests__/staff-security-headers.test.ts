import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { newNonce, staffContentSecurityPolicy, staffSecurityHeaders } from '@/shared/lib/staffSecurityHeaders';
import { THEME_SCRIPT, THEME_SCRIPT_SHA256 } from '@/shared/lib/themeScript';

// next-intl needs a request context this test has no business building; stand it in with a
// response that records which request headers it was asked to forward.
vi.mock('next-intl/middleware', () => ({
    default: () => (req: NextRequest) => NextResponse.next({ request: { headers: req.headers } }),
}));

/**
 * ADR-0006: the staff host carries noindex, HSTS, X-Frame-Options: DENY and a strict CSP — and
 * staff pages show passenger names and card metadata, so none of it can be missing from any
 * response that host sends.
 */

const directive = (csp: string, name: string) =>
    csp.split('; ').find((d) => d === name || d.startsWith(`${name} `));

describe('staffSecurityHeaders', () => {
    it('carries every header ADR-0006 and the security review require', () => {
        expect(staffSecurityHeaders({ nonce: 'abc' })).toEqual({
            'Content-Security-Policy':   expect.any(String),
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Frame-Options':           'DENY',
            'X-Content-Type-Options':    'nosniff',
            'Referrer-Policy':           'no-referrer',
            'X-Robots-Tag':              'noindex, nofollow',
        });
    });

    it('allows only scripts carrying this request’s nonce — no inline, no eval in production', () => {
        const csp = staffContentSecurityPolicy({ nonce: 'abc' });

        expect(directive(csp, 'script-src')).toBe(
            `script-src 'self' 'nonce-abc' 'sha256-${THEME_SCRIPT_SHA256}' 'strict-dynamic'`,
        );
        expect(directive(csp, 'script-src')).not.toMatch(/unsafe-inline/);
        expect(csp).not.toMatch(/unsafe-eval/);
        expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
        expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
        expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    });

    it('loosens only what local development needs', () => {
        const csp = staffContentSecurityPolicy({ nonce: 'abc', dev: true });

        expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
        expect(directive(csp, 'connect-src')).toBe("connect-src 'self' ws: wss:");
    });

    it('allows the root layout’s theme script by a hash that matches it', () => {
        // A stale hash would not fail loudly anywhere else: the staff host would just block the
        // script, and every staff page would lose its theme class.
        expect(createHash('sha256').update(THEME_SCRIPT, 'utf8').digest('base64')).toBe(THEME_SCRIPT_SHA256);
    });

    it('makes a different nonce every time', () => {
        expect(newNonce()).not.toBe(newNonce());
    });
});

describe('the middleware on the staff host', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    async function middlewareFor(staffHost: string | undefined) {
        vi.stubEnv('NEXT_PUBLIC_STAFF_HOST', staffHost ?? '');
        vi.stubEnv('NODE_ENV', 'production');
        vi.resetModules();
        return (await import('@/middleware')).default;
    }

    const request = (url: string, cookie?: string) =>
        new NextRequest(url, { headers: { host: new URL(url).host, ...(cookie ? { cookie } : {}) } });

    const SIX = ['content-security-policy', 'strict-transport-security', 'x-frame-options',
        'x-content-type-options', 'referrer-policy', 'x-robots-tag'];

    it.each([
        ['a signed-in admin page',           'https://staff.cheapestgo.com/admin/payments', 'access_token=t'],
        ['the redirect to sign in',          'https://staff.cheapestgo.com/admin/payments', undefined],
        ['the redirect from a storefront path', 'https://staff.cheapestgo.com/hotels',      undefined],
        ['the sign-in page',                 'https://staff.cheapestgo.com/en/login',       undefined],
    ])('puts every header on %s', async (_label, url, cookie) => {
        const middleware = await middlewareFor('staff.cheapestgo.com');

        const res = middleware(request(url, cookie));

        for (const name of SIX) expect(res.headers.get(name), name).toBeTruthy();
    });

    it('hands the same nonce to the render that the browser is told to expect', async () => {
        const middleware = await middlewareFor('staff.cheapestgo.com');

        const res = middleware(request('https://staff.cheapestgo.com/admin/payments', 'access_token=t'));

        // NextResponse.next({ request }) carries the forwarded request headers as x-middleware-request-*.
        const forwarded = res.headers.get('x-middleware-request-content-security-policy');
        expect(forwarded).toBe(res.headers.get('content-security-policy'));
        expect(forwarded).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    });

    it('forwards the CSP into the sign-in page’s render too', async () => {
        const middleware = await middlewareFor('staff.cheapestgo.com');

        const res = middleware(request('https://staff.cheapestgo.com/en/login'));

        expect(res.headers.get('x-middleware-request-content-security-policy'))
            .toBe(res.headers.get('content-security-policy'));
    });

    it('leaves the storefront exactly as it was', async () => {
        const middleware = await middlewareFor('staff.cheapestgo.com');

        const res = middleware(request('https://cheapestgo.com/en/hotels'));

        for (const name of SIX) expect(res.headers.get(name), name).toBeNull();
    });
});
