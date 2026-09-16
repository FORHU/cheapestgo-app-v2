import { describe, expect, it } from 'vitest';
import { canonicalBrandName, brandWordmark } from '../brand';

describe('brand name', () => {
    it('shows the new name while the deployment still says the old one', () => {
        // The whole point of the mapping. The Korean instance keeps running with
        // NEXT_PUBLIC_BRAND_NAME=GeomeeGo until it is rebuilt, and the UI must already
        // read AirangGo — that is what "rename the UI ahead of deployment" means here.
        expect(canonicalBrandName('GeomeeGo')).toBe('AirangGo');
        expect(canonicalBrandName('AirangGo')).toBe('AirangGo');
    });

    it('leaves brands that were never renamed alone', () => {
        expect(canonicalBrandName('CheapestGo')).toBe('CheapestGo');
        expect(canonicalBrandName('SomeOtherBrand')).toBe('SomeOtherBrand');
    });

    it('falls back to CheapestGo when nothing is configured', () => {
        expect(canonicalBrandName(undefined)).toBe('CheapestGo');
        expect(canonicalBrandName('')).toBe('CheapestGo');
        expect(canonicalBrandName('   ')).toBe('CheapestGo');
    });

    it('splits the wordmark so the trailing Go can be accented', () => {
        expect(brandWordmark('CheapestGo')).toEqual({ head: 'Cheapest', tail: 'Go' });
        expect(brandWordmark('AirangGo')).toEqual({ head: 'Airang', tail: 'Go' });
    });

    it('spells the Korean brand correctly from the old name', () => {
        // The admin sidebar rendered "GeomeGo" — one e short — because the split was
        // written out by hand in five places. Derived from the name, that cannot recur.
        expect(brandWordmark('GeomeeGo')).toEqual({ head: 'Airang', tail: 'Go' });
    });

    it('does not mangle a brand that does not end in Go', () => {
        expect(brandWordmark('Wanderlust')).toEqual({ head: 'Wanderlust', tail: '' });
        // "Go" alone is the whole name, not a head of nothing plus an accent.
        expect(brandWordmark('Go')).toEqual({ head: 'Go', tail: '' });
    });
});
