import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/**
 * The translations name CheapestGo outright — the sign-in prompt, the footer, and the
 * privacy and cookie policies, which state which site collects the reader's data. Served
 * from GeomeeGo's domain those sentences name the wrong site, so the brand is substituted
 * as the messages load.
 *
 * Addresses are deliberately left alone: `support@cheapestgo.com` is a mailbox that
 * exists, and `support@geomeego.com` may not.
 */
describe('applyBrand', () => {
    const load = async (brand?: string) => {
        vi.resetModules();
        if (brand === undefined) delete process.env.NEXT_PUBLIC_BRAND_NAME;
        else process.env.NEXT_PUBLIC_BRAND_NAME = brand;
        // Re-imported per case so the module reads the brand set above.
        return (await import('../applyBrand')).applyBrand;
    };

    const original = process.env.NEXT_PUBLIC_BRAND_NAME;
    beforeEach(() => { delete process.env.NEXT_PUBLIC_BRAND_NAME; });
    afterEach(() => {
        if (original === undefined) delete process.env.NEXT_PUBLIC_BRAND_NAME;
        else process.env.NEXT_PUBLIC_BRAND_NAME = original;
    });

    it('renames the brand in prose', async () => {
        const applyBrand = await load('GeomeeGo');
        expect(applyBrand({ title: 'Sign in to CheapestGo' }))
            .toEqual({ title: 'Sign in to GeomeeGo' });
    });

    it('renames it in a policy that says who collects the data', async () => {
        const applyBrand = await load('GeomeeGo');
        expect(applyBrand({ p: 'How CheapestGo collects, uses, and protects your personal information.' }))
            .toEqual({ p: 'How GeomeeGo collects, uses, and protects your personal information.' });
    });

    it('leaves email addresses and hosts untouched', async () => {
        const applyBrand = await load('GeomeeGo');
        expect(applyBrand({
            email: 'support@cheapestgo.com',
            site:  'https://www.cheapestgo.com/terms',
        })).toEqual({
            email: 'support@cheapestgo.com',
            site:  'https://www.cheapestgo.com/terms',
        });
    });

    it('renames every occurrence in one string', async () => {
        const applyBrand = await load('GeomeeGo');
        expect(applyBrand({ s: 'CheapestGo and CheapestGo' })).toEqual({ s: 'GeomeeGo and GeomeeGo' });
    });

    it('walks nested objects and arrays', async () => {
        const applyBrand = await load('GeomeeGo');
        expect(applyBrand({ a: { b: ['Book with CheapestGo', 'x'] }, n: 3, z: null }))
            .toEqual({ a: { b: ['Book with GeomeeGo', 'x'] }, n: 3, z: null });
    });

    it('is a no-op for the primary brand, including its ICU placeholders', async () => {
        const applyBrand = await load('CheapestGo');
        const messages = { t: 'Hotels in {city} | CheapestGo' };
        expect(applyBrand(messages)).toBe(messages);
    });

    it('preserves ICU placeholders when rebranding', async () => {
        const applyBrand = await load('GeomeeGo');
        expect(applyBrand({ t: 'Hotels in {city}, {country} — Cheapest Rates | CheapestGo' }))
            .toEqual({ t: 'Hotels in {city}, {country} — Cheapest Rates | GeomeeGo' });
    });
});
