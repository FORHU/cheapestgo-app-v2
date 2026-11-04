import { describe, expect, it } from 'vitest';
import { extrasCourseTotal, formatExtrasParam, parseExtrasParam } from '@/features/golf/lib/extras';

describe('the checkout address', () => {
    it('reads choices, in list order', () => {
        expect(parseExtrasParam('cart:1,club_rental:2')).toEqual([
            { code: 'club_rental', quantity: 2 }, { code: 'cart', quantity: 1 },
        ]);
    });

    it('drops what it cannot read', () => {
        expect(parseExtrasParam('sauna:1,cart:x,caddie:0,cart:2,cart:3')).toEqual([{ code: 'cart', quantity: 2 }]);
        expect(parseExtrasParam(undefined)).toEqual([]);
    });

    it('writes the same choices the same way, whatever order they were made in', () => {
        const a = formatExtrasParam([{ code: 'cart', quantity: 1 }, { code: 'caddie', quantity: 2 }]);
        const b = formatExtrasParam([{ code: 'caddie', quantity: 2 }, { code: 'cart', quantity: 1 }]);
        expect(a).toBe(b);
        expect(a).toBe('caddie:2,cart:1');
        expect(parseExtrasParam(a)).toEqual([{ code: 'caddie', quantity: 2 }, { code: 'cart', quantity: 1 }]);
    });
});

describe('extrasCourseTotal', () => {
    it('adds up what the course asks, at its own price', () => {
        expect(extrasCourseTotal([{ quantity: 2, unitPrice: 4000 }, { quantity: 1, unitPrice: 1500 }])).toBe(9500);
        expect(extrasCourseTotal([])).toBe(0);
    });
});
