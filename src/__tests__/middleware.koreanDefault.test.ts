// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// A pass-through, as in middleware.brandPreview.test.ts: "no redirect from our middleware" is
// the same as "handed to the locale middleware".
vi.mock('next-intl/middleware', () => ({
    default: () => () => NextResponse.next(),
}));

import middleware from '@/middleware';

/**
 * AirangGo is the Korean brand, so it opens in Korean. These pin when that default applies —
 * nothing picked yet, on a page address — and the cases it must leave alone: a language the
 * visitor chose, an address that already names one, the other brand, and a build locked to Korean.
 */
describe('middleware: AirangGo opens in Korean', () => {
    const original = { preview: process.env.BRAND_PREVIEW, locale: process.env.NEXT_PUBLIC_LOCALE };

    beforeEach(() => {
        process.env.BRAND_PREVIEW = '1';
        delete process.env.NEXT_PUBLIC_LOCALE;
    });
    afterEach(() => {
        if (original.preview === undefined) delete process.env.BRAND_PREVIEW;
        else process.env.BRAND_PREVIEW = original.preview;
        if (original.locale === undefined) delete process.env.NEXT_PUBLIC_LOCALE;
        else process.env.NEXT_PUBLIC_LOCALE = original.locale;
    });

    const call = (path: string, init: { cookie?: string; host?: string; language?: string } = {}) => {
        const headers = new Headers();
        if (init.cookie) headers.set('cookie', init.cookie);
        if (init.language) headers.set('accept-language', init.language);
        // Set as a header because that is what is read: a request built from a URL carries none.
        const host = init.host ?? 'localhost:3002';
        headers.set('host', host);
        return middleware(new NextRequest(`http://${host}${path}`, { headers }));
    };
    const location = (res: NextResponse) => {
        const value = res.headers.get('location');
        return value === null ? null : new URL(value);
    };

    it('sends an unprefixed page to the same page in Korean, query and all', () => {
        const res = call('/hotels?city=seoul', { cookie: 'brand_preview=AirangGo' });

        expect(res.status).toBe(307);
        expect(location(res)?.pathname).toBe('/ko/hotels');
        expect(location(res)?.searchParams.get('city')).toBe('seoul');
    });

    it('sends the home page to the Korean home page', () => {
        expect(location(call('/', { cookie: 'brand_preview=AirangGo' }))?.pathname).toBe('/ko');
    });

    it('outranks an English browser, as the locked production build does', () => {
        const res = call('/about', { cookie: 'brand_preview=AirangGo', language: 'en-US,en;q=0.9' });
        expect(location(res)?.pathname).toBe('/ko/about');
    });

    it('applies on the brand\'s own domain with nothing picked', () => {
        expect(location(call('/about', { host: 'v2.airanggo.com' }))?.pathname).toBe('/ko/about');
    });

    it('leaves a language the visitor picked to the locale middleware', () => {
        // The language menu sets next-intl's cookie on every switch, English included.
        const res = call('/about', { cookie: 'brand_preview=AirangGo; NEXT_LOCALE=en' });
        expect(res.headers.get('location')).toBeNull();
    });

    it('leaves an address that already names a language alone', () => {
        expect(call('/ja/about', { cookie: 'brand_preview=AirangGo' }).headers.get('location')).toBeNull();
        expect(call('/ko', { cookie: 'brand_preview=AirangGo' }).headers.get('location')).toBeNull();
    });

    it('leaves routes that are not pages alone', () => {
        expect(call('/api/og', { cookie: 'brand_preview=AirangGo' }).headers.get('location')).toBeNull();
    });

    it('does nothing for CheapestGo', () => {
        expect(call('/about', { cookie: 'brand_preview=CheapestGo' }).headers.get('location')).toBeNull();
        expect(call('/about').headers.get('location')).toBeNull();
    });

    it('does nothing on a build locked to one language', () => {
        // Locked, every unprefixed address is already Korean and is the canonical one (seo.ts).
        process.env.NEXT_PUBLIC_LOCALE = 'ko';
        expect(call('/about', { cookie: 'brand_preview=AirangGo' }).headers.get('location')).toBeNull();
    });
});

describe('middleware: an AirangGo build with the preview off', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('opens in Korean too', async () => {
        // The build's brand is read when `brand.ts` loads, so the module is loaded fresh under it.
        vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', 'AirangGo');
        vi.stubEnv('BRAND_PREVIEW', '');
        vi.stubEnv('NEXT_PUBLIC_LOCALE', '');
        vi.resetModules();
        const { default: fresh } = await import('@/middleware');

        const res = fresh(new NextRequest('http://localhost:3002/about'));
        expect(new URL(res.headers.get('location')!).pathname).toBe('/ko/about');
    });
});
