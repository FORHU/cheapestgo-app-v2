import { describe, it, expect } from 'vitest';
import { ACCENT, ACCENT_FILL, checkoutPalette } from '../palette';
import { BRAND, brandTheme } from '@/shared/lib/palette';

/**
 * The checkout paints with the brand (`shared/lib/palette.ts`) — the obsidian/alabaster
 * ground, slate ink, and the blue family — as the landing, search and property pages it is
 * reached from do. It used to carry its own violet fields and an orange accent.
 */
describe('checkout palette', () => {
    it('takes its accent from the brand\'s blue family, and its fill from the brand gradient', () => {
        expect(ACCENT).toBe(BRAND.primary);
        expect(ACCENT_FILL).toBe(BRAND.gradient);
    });

    it.each(['dark', 'light'] as const)('reads the %s ground and ink from the brand theme', (theme) => {
        const p = checkoutPalette(theme);
        const b = brandTheme(theme);
        expect(p.bg).toBe(b.ground);
        expect(p.title).toBe(b.title);
        expect(p.text).toBe(b.text);
        expect(p.muted).toBe(b.muted);
    });

    it('fills fields with the brand\'s slate in the dark, and white in the light', () => {
        expect(checkoutPalette('dark').fieldBg).toBe('#1e293b');
        expect(checkoutPalette('light').fieldBg).toBe('#ffffff');
    });

    it('draws icons in the theme\'s blue', () => {
        expect(checkoutPalette('dark').icon).toBe(BRAND.accent);
        expect(checkoutPalette('light').icon).toBe(BRAND.primaryStrong);
    });

    it('has no violet or orange left in it', () => {
        for (const theme of ['dark', 'light'] as const) {
            const values = Object.values(checkoutPalette(theme)).join(' ').toLowerCase();
            expect(values).not.toMatch(/#2c2836|#eeedf2|#141018|#ff6b4b/);
        }
    });
});
