import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * How the middleware decides what each hostname may serve.
 *
 * Mirrored rather than imported: `src/middleware.ts` pulls in next-intl, which needs a
 * request context this test has no business building, and the part worth pinning is the
 * decision — not the plumbing around it. The predicates below must stay identical to the
 * ones there.
 *
 * Two failure modes make this worth testing at all. Gating on a hostname before the proxy
 * sends that hostname anywhere makes the back office unreachable from everywhere at once.
 * And allowing only the bare `/login` sends staff into a redirect loop, because the sign-in
 * page lives under `[locale]` and the path is `/en/login` by the time anyone arrives.
 */

const LOGIN = /^\/([a-z]{2}\/)?login(\/|$)/;

/** What the middleware does with a request, as a word. */
function decide(opts: { staffHost?: string; host: string; pathname: string; signedIn: boolean }) {
    const { staffHost, host, pathname, signedIn } = opts;
    const onStaffHost = staffHost !== undefined && host === staffHost;

    if (pathname.startsWith('/admin')) {
        if (staffHost !== undefined && !onStaffHost) return '404';
        return signedIn ? 'serve' : 'redirect:login';
    }
    if (onStaffHost && !LOGIN.test(pathname)) return 'redirect:admin';
    return 'storefront';
}

/** What the middleware derives from the raw environment value. */
const staffHostFrom = (raw: string | undefined) => raw?.trim().toLowerCase() || undefined;

describe('reading the staff host from the environment', () => {
    it.each([
        ['unset',             undefined],
        ['empty',             ''],
        ['whitespace',        '   '],
    ])('treats %s as not configured', (_label, raw) => {
        // An unset GitHub variable reaches the build as an empty string, not as nothing.
        // Reading that as "configured to match no host" 404s the back office everywhere.
        expect(staffHostFrom(raw)).toBeUndefined();
        expect(decide({ staffHost: staffHostFrom(raw), host: 'cheapestgo.com', pathname: '/admin', signedIn: true }))
            .toBe('serve');
    });

    it('lowercases and trims a real value', () => {
        expect(staffHostFrom('  Admin.CheapestGo.com ')).toBe('admin.cheapestgo.com');
    });
});

describe('before a staff host is configured', () => {
    const base = { staffHost: undefined, host: 'cheapestgo.com', signedIn: true };

    it('serves /admin on the storefront exactly as before', () => {
        expect(decide({ ...base, pathname: '/admin/overview' })).toBe('serve');
    });

    it('still bounces a signed-out visitor to the login page', () => {
        expect(decide({ ...base, signedIn: false, pathname: '/admin' })).toBe('redirect:login');
    });

    it('leaves the storefront alone', () => {
        expect(decide({ ...base, pathname: '/en/search' })).toBe('storefront');
    });
});

describe('once a staff host is configured', () => {
    const staffHost = 'admin.cheapestgo.com';

    it('404s the back office on the storefront host', () => {
        // Not a redirect: the storefront should not advertise that there is somewhere else.
        expect(decide({ staffHost, host: 'cheapestgo.com', pathname: '/admin/stripe', signedIn: true }))
            .toBe('404');
    });

    it('serves the back office on the staff host', () => {
        expect(decide({ staffHost, host: staffHost, pathname: '/admin/overview', signedIn: true }))
            .toBe('serve');
    });

    it('sends a signed-out visitor on the staff host to the login page', () => {
        expect(decide({ staffHost, host: staffHost, pathname: '/admin/desk', signedIn: false }))
            .toBe('redirect:login');
    });

    it('keeps the storefront off the staff host', () => {
        expect(decide({ staffHost, host: staffHost, pathname: '/en/search', signedIn: true }))
            .toBe('redirect:admin');
    });

    it('lets the login page through on the staff host, with or without a locale', () => {
        // The loop this prevents: /admin → /login → (not allowed) → /admin → …
        for (const p of ['/login', '/en/login', '/ko/login', '/login/']) {
            expect(decide({ staffHost, host: staffHost, pathname: p, signedIn: false }), p)
                .not.toBe('redirect:admin');
        }
    });

    it('does not mistake another path for the login page', () => {
        for (const p of ['/loginhelp', '/en/login-help', '/help/login-issues']) {
            expect(decide({ staffHost, host: staffHost, pathname: p, signedIn: true }), p)
                .toBe('redirect:admin');
        }
    });

    it('ignores the port when comparing hostnames', () => {
        // `host` carries one in development; the middleware strips it before comparing.
        const host = 'admin.cheapestgo.com:3000'.split(':')[0];
        expect(decide({ staffHost, host, pathname: '/admin', signedIn: true })).toBe('serve');
    });
});

describe('the mirror above still matches the middleware', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8');

    it('uses the same login pattern', () => {
        // Without this the mirror can drift from the real thing and keep passing, which
        // would make every test above a statement about nothing.
        expect(source).toContain(LOGIN.source);
    });

    it('still reads the staff host from the environment and strips the port', () => {
        expect(source).toContain('NEXT_PUBLIC_STAFF_HOST');
        expect(source).toMatch(/host.*split\(':'\)/);
    });

    it('still coerces an empty staff host to undefined', () => {
        // Without the `|| undefined`, an unset GitHub variable arrives as '' and the gate
        // engages against a host nothing matches.
        expect(source).toMatch(/NEXT_PUBLIC_STAFF_HOST[^\n]*\|\|\s*undefined/);
    });

    it('still accepts both session cookie names', () => {
        // Dropping the legacy name signs out everyone holding a session issued before the
        // `__Host-` rename.
        expect(source).toContain("'__Host-access_token'");
        expect(source).toContain("'access_token'");
    });
});
