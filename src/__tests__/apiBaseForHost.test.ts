import { describe, expect, it } from 'vitest';
import { apiBaseForHost } from '@/shared/lib/env';

/**
 * One build serves the storefront and the staff host, so the baked API URL is only right for
 * one of them. Reaching the storefront's origin from the staff host sets `__Host-access_token`
 * on the storefront — host-scoped, by design — and the staff host's middleware then never sees
 * a session: `/admin` redirects to `/login` forever. These cases pin which host gets rewritten.
 */
const API = 'https://v2.cheapestgo.com/api/v2';
const STAFF = 'staff.cheapestgo.com';

describe('apiBaseForHost', () => {
    it('serves the staff host from its own origin', () => {
        expect(apiBaseForHost(API, STAFF, STAFF)).toBe('/api/v2');
    });

    it('leaves the storefront on the absolute URL', () => {
        expect(apiBaseForHost(API, 'v2.cheapestgo.com', STAFF)).toBe(API);
    });

    // An unset GitHub variable arrives as an empty build arg rather than an absent one, so
    // "not configured" must not read as "configured to match nothing" — that would rewrite
    // every host at once, and local development has no proxy to rewrite to.
    it.each([undefined, null, '', '   '])('leaves every host alone when the staff host is %p', (staff) => {
        expect(apiBaseForHost(API, STAFF, staff)).toBe(API);
    });

    it('keeps the absolute URL on the server, where there is no current host', () => {
        expect(apiBaseForHost(API, null, STAFF)).toBe(API);
    });

    it('matches the host case-insensitively', () => {
        expect(apiBaseForHost(API, 'Staff.CheapestGo.com', ' STAFF.cheapestgo.COM ')).toBe('/api/v2');
    });

    it('keeps local development pointed at the API port', () => {
        const local = 'http://localhost:4000/api/v2';
        expect(apiBaseForHost(local, 'localhost', STAFF)).toBe(local);
    });

    // Every call site writes its own leading slash, so the base must not end in one.
    it('drops a trailing slash', () => {
        expect(apiBaseForHost('https://v2.cheapestgo.com/api/v2/', STAFF, STAFF)).toBe('/api/v2');
    });

    it('falls back to what it was given if that is not a URL', () => {
        expect(apiBaseForHost('not-a-url', STAFF, STAFF)).toBe('not-a-url');
    });
});
