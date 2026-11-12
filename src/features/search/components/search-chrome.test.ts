import { describe, it, expect } from 'vitest';
import { sortPalette } from './search-chrome';

/**
 * The toolbar palette is what floating menus are drawn from, so its text has to be readable
 * on its own menu ground in both tones — the account menu's name, email and sign-out were
 * not, on the light map toolbar. WCAG AA for body text is 4.5:1.
 */

const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

describe.each(['light', 'dark'] as const)('sortPalette(%s)', (tone) => {
    const p = sortPalette(tone);

    it('has text that reads on the menu ground', () => {
        expect(contrast(p.text, p.menu)).toBeGreaterThanOrEqual(4.5);
    });

    it('has a danger colour that reads on the menu ground', () => {
        expect(contrast(p.danger, p.menu)).toBeGreaterThanOrEqual(4.5);
    });
});
