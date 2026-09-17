import { describe, it, expect } from 'vitest';
import { localePath, servedLocalePaths, hreflang, canonicalPath, PREFIXED_LOCALES } from '../seo';

/**
 * Which URLs a deployment claims are its own.
 *
 * Every function takes the locked locale explicitly so the rules can be checked for both
 * shapes of deployment in one run — `NEXT_PUBLIC_LOCALE` is read at module load in the real
 * thing, and a test that mutated it would only ever see whichever value won.
 */

const UNLOCKED = null;
const AIRANGGO = 'ko';

describe('an unlocked deployment (CheapestGo)', () => {
    it('serves English unprefixed and the others under a prefix', () => {
        expect(localePath('/terms', 'en', UNLOCKED)).toBe('/terms');
        expect(localePath('/terms', 'ja', UNLOCKED)).toBe('/ja/terms');
        expect(localePath('/', 'zh', UNLOCKED)).toBe('/zh');
    });

    it('does not advertise Korean', () => {
        // A language has exactly one home and Korean's is airanggo.com (ADR-0037). `/ko` still
        // answers — it is simply no longer claimed here.
        expect(PREFIXED_LOCALES).not.toContain('ko');
        expect(Object.keys(hreflang('/terms', UNLOCKED)!)).not.toContain('ko');
        expect(servedLocalePaths('/terms', UNLOCKED).map(s => s.locale)).not.toContain('ko');
    });

    it('gives each language a canonical naming its own URL', () => {
        // Returning the unprefixed path made every /ja and /zh page declare the English page
        // as canonical, which tells Google they are duplicates rather than pages of their own.
        expect(canonicalPath('/terms', 'ja', UNLOCKED)).toBe('/ja/terms');
        expect(canonicalPath('/terms', 'en', UNLOCKED)).toBe('/terms');
    });

    it('points x-default at the English page', () => {
        expect(hreflang('/terms', UNLOCKED)!['x-default']).toBe('/terms');
    });
});

describe('a locked deployment (AirangGo)', () => {
    it('serves its one language at the root, with no prefix', () => {
        // A prefix does not switch language there — airanggo.com/ja/about renders Korean.
        expect(localePath('/terms', 'ko', AIRANGGO)).toBe('/terms');
        expect(localePath('/terms', 'ja', AIRANGGO)).toBe('/terms');
    });

    it('declares no alternates, because it has nothing to alternate with', () => {
        expect(hreflang('/terms', AIRANGGO)).toBeUndefined();
    });

    it('lists only its own language in the sitemap', () => {
        expect(servedLocalePaths('/terms', AIRANGGO)).toEqual([{ locale: 'ko', path: '/terms' }]);
    });

    it('folds a prefixed URL onto the real one rather than letting it stand alone', () => {
        expect(canonicalPath('/terms', 'ja', AIRANGGO)).toBe('/terms');
    });
});
