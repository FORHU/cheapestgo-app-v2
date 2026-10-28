// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// The locale middleware is not under test, and next-intl's ESM build imports `next/server`
// without an extension, which does not resolve here. A pass-through is what these cases need:
// "the locale middleware ran" is the same as "the brand preview stayed out of the way".
vi.mock('next-intl/middleware', () => ({
    default: () => () => NextResponse.next(),
}));

import middleware from '@/middleware';

/**
 * The brand preview's one entry point is `?brand_preview=` on a request. These pin both sides of
 * it: that it works where the preview is on, and — the half that matters on production — that it
 * does nothing where it is off, so a crafted link cannot re-brand a page for whoever opens it.
 */
describe('middleware: brand preview', () => {
    const original = { preview: process.env.BRAND_PREVIEW, node: process.env.NODE_ENV };

    beforeEach(() => { delete process.env.BRAND_PREVIEW; });
    afterEach(() => {
        if (original.preview === undefined) delete process.env.BRAND_PREVIEW;
        else process.env.BRAND_PREVIEW = original.preview;
    });

    const call = (path: string) => middleware(new NextRequest(`http://localhost:3002${path}`));

    it('remembers the pick and sends the visitor on to the same page without the parameter', () => {
        process.env.BRAND_PREVIEW = '1';
        const res = call('/hotels?brand_preview=airanggo&city=seoul');

        expect(res.status).toBe(307);
        // The other parameters survive: a shared search link should still be that search.
        const location = new URL(res.headers.get('location')!);
        expect(location.pathname).toBe('/hotels');
        expect(location.searchParams.get('city')).toBe('seoul');
        expect(location.searchParams.has('brand_preview')).toBe(false);

        const cookie = res.cookies.get('brand_preview');
        expect(cookie?.value).toBe('AirangGo');
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.sameSite).toBe('lax');
        expect(cookie?.path).toBe('/');
    });

    it('stores the canonical name, whatever spelling the link used', () => {
        process.env.BRAND_PREVIEW = '1';
        expect(call('/?brand_preview=GEOMEEGO').cookies.get('brand_preview')?.value).toBe('AirangGo');
        expect(call('/?brand_preview=cheapestgo').cookies.get('brand_preview')?.value).toBe('CheapestGo');
    });

    it('drops the parameter but stores nothing for a value that is not a brand', () => {
        process.env.BRAND_PREVIEW = '1';
        const res = call('/?brand_preview=%3Cscript%3E');

        expect(res.status).toBe(307);
        expect(new URL(res.headers.get('location')!).searchParams.has('brand_preview')).toBe(false);
        expect(res.cookies.get('brand_preview')).toBeUndefined();
    });

    it('clears the pick on `default`', () => {
        process.env.BRAND_PREVIEW = '1';
        const res = call('/?brand_preview=default');

        expect(res.status).toBe(307);
        const cookie = res.cookies.get('brand_preview');
        // A deleted cookie is a Set-Cookie with an empty value that has already expired.
        expect(cookie?.value ?? '').toBe('');
    });

    it('does nothing at all when the preview is off', () => {
        const res = call('/?brand_preview=airanggo');

        expect(res.headers.get('location')).toBeNull();
        expect(res.cookies.get('brand_preview')).toBeUndefined();
    });

    it('leaves a request without the parameter to the locale middleware', () => {
        process.env.BRAND_PREVIEW = '1';
        const res = call('/about');

        expect(res.headers.get('location')).toBeNull();
        expect(res.cookies.get('brand_preview')).toBeUndefined();
    });
});
