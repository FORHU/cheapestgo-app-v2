import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOLF_FACE, isGolfFace, lastGolfSearch, rememberGolfSearch } from '@/features/golf/lib/last-search';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('lastGolfSearch', () => {
    it('is the catalogue for a tab with no search behind it, as a shared link opens', () => {
        expect(lastGolfSearch()).toBe('/golf');
    });

    it('is the search last used', () => {
        rememberGolfSearch('/golf?country=Japan');
        rememberGolfSearch(GOLF_FACE);
        expect(lastGolfSearch()).toBe(GOLF_FACE);
    });

    it('still gives somewhere to go where storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(() => rememberGolfSearch('/golf?country=Japan')).not.toThrow();
        expect(lastGolfSearch()).toBe('/golf');
    });
});

describe('isGolfFace', () => {
    it('knows the address of the landing page on its Golf face, and no other', () => {
        expect(isGolfFace(new URL(GOLF_FACE, 'https://x.test').search)).toBe(true);
        expect(isGolfFace('')).toBe(false);
        expect(isGolfFace('?search=stays')).toBe(false);
    });
});
