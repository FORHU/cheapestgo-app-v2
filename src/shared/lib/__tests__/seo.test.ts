import { describe, it, expect } from 'vitest';
import { localePath, servedLocalePaths, hreflang, canonicalPath, PREFIXED_LOCALES } from '../seo';

/**
 * Which URLs a deployment claims are its own, and which it points at the other domain.
 *
 * Every function takes the locked locale explicitly so both shapes of deployment can be
 * checked in one run — `NEXT_PUBLIC_LOCALE` is read at module load in the real thing, and a
 * test that mutated it would only ever see whichever value won.
 */

const UNLOCKED = null;   // CheapestGo: en at the root, ja/zh prefixed
const AIRANGGO = 'ko';   // locked to one language, served at the root

describe('an unlocked deployment (CheapestGo)', () => {
    it('serves English unprefixed and its own others under a prefix', () => {
        expect(localePath('/terms', 'en', UNLOCKED)).toBe('/terms');
        expect(localePath('/terms', 'ja', UNLOCKED)).toBe('/ja/terms');
        expect(localePath('/', 'zh', UNLOCKED)).toBe('/zh');
    });

    it('keeps Korean out of its own sitemap', () => {
        // A language has exactly one home and Korean's is airanggo.com (ADR-0037). `/ko` still
        // answers here until the redirect lands; it is simply not advertised as ours.
        expect(PREFIXED_LOCALES).not.toContain('ko');
        expect(servedLocalePaths('/terms', UNLOCKED).map((s) => s.locale)).not.toContain('ko');
    });

    it('names its own languages relatively and Korean at airanggo.com', () => {
        expect(hreflang('/terms', UNLOCKED)).toEqual({
            en: '/terms',
            ja: '/ja/terms',
            zh: '/zh/terms',
            ko: 'https://airanggo.com/terms',
            'x-default': '/terms',
        });
    });

    it('gives each language a canonical naming its own URL', () => {
        // Returning the unprefixed path made every /ja and /zh page declare the English page
        // as canonical, which tells Google they are duplicates rather than pages of their own.
        expect(canonicalPath('/terms', 'ja', UNLOCKED)).toBe('/ja/terms');
        expect(canonicalPath('/terms', 'en', UNLOCKED)).toBe('/terms');
    });
});

describe('a locked deployment (AirangGo)', () => {
    it('serves its one language at the root, with no prefix', () => {
        // A prefix does not switch language there — airanggo.com/ja/about renders Korean.
        expect(localePath('/terms', 'ko', AIRANGGO)).toBe('/terms');
        expect(localePath('/terms', 'ja', AIRANGGO)).toBe('/terms');
    });

    it('names Korean relatively and the rest at cheapestgo.com', () => {
        // It used to emit en/ja/zh at its own domain, where those URLs render Korean. They now
        // point at the pages that actually serve those languages.
        expect(hreflang('/terms', AIRANGGO)).toEqual({
            en: 'https://cheapestgo.com/terms',
            ja: 'https://cheapestgo.com/ja/terms',
            zh: 'https://cheapestgo.com/zh/terms',
            ko: '/terms',
            'x-default': 'https://cheapestgo.com/terms',
        });
    });

    it('lists only its own language in the sitemap', () => {
        expect(servedLocalePaths('/terms', AIRANGGO)).toEqual([{ locale: 'ko', path: '/terms' }]);
    });

    it('folds a prefixed URL onto the real one rather than letting it stand alone', () => {
        expect(canonicalPath('/terms', 'ja', AIRANGGO)).toBe('/terms');
    });
});

describe('the two domains together', () => {
    it('shapes the home page without a trailing prefix slash', () => {
        expect(hreflang('/', AIRANGGO).ja).toBe('https://cheapestgo.com/ja');
        expect(hreflang('/', UNLOCKED).ko).toBe('https://airanggo.com/');
    });

    it('declares the identical set from both domains', () => {
        // The rule Google enforces: an alternate only counts if the page it names declares the
        // same set back. Resolved against each domain, both must say exactly the same thing —
        // otherwise every alternate is discarded and the work is wasted rather than wrong.
        const resolve = (map: Record<string, string>, origin: string) =>
            Object.fromEntries(Object.entries(map).map(([l, url]) => [l, new URL(url, origin).href]));

        for (const path of ['/', '/terms', '/property/31810']) {
            expect(resolve(hreflang(path, UNLOCKED), 'https://cheapestgo.com'))
                .toEqual(resolve(hreflang(path, AIRANGGO), 'https://airanggo.com'));
        }
    });
});
