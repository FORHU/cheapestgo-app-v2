import { describe, it, expect } from 'vitest';
import { checkoutPalette } from '@/features/checkout/lib/palette';
import { stripeAppearance, TOUCH_SIZING_QUERY } from '@/features/checkout/lib/stripe-appearance';

const palette = checkoutPalette('dark');

describe('stripeAppearance', () => {
    it('keeps the card form at the details step\'s mouse sizes on a wide screen', () => {
        const a = stripeAppearance(palette, 'dark', false);
        expect(a.variables?.fontSizeBase).toBe('14px');
        expect(a.rules?.['.Input']).toMatchObject({ padding: '12px 16px' });
        expect(a.rules?.['.Label']).toMatchObject({ fontSize: '13px' });
    });

    it('gives a phone or touch screen the details step\'s touch sizes: 16px text, which also stops iOS zooming in', () => {
        const a = stripeAppearance(palette, 'dark', true);
        expect(a.variables?.fontSizeBase).toBe('16px');
        expect(a.rules?.['.Input']).toMatchObject({ padding: '14px 16px' });
        expect(a.rules?.['.Label']).toMatchObject({ fontSize: '14px' });
    });

    it('switches on the same query globals.css sizes the checkout\'s own fields by', () => {
        expect(TOUCH_SIZING_QUERY).toBe('(max-width: 639px), (pointer: coarse)');
    });
});
