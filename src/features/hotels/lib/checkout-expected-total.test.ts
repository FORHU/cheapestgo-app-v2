/**
 * The room total checkout may be asked to compare the server's quote against.
 *
 * `checkoutMoney`'s total is a placeholder — per-night times nights, run through whichever
 * exchange rates the browser happened to have. Compared with the server's own figure, two rate
 * sources disagreeing by a cent would announce a "price change" to someone about to pay. So an
 * expected total is offered only when the browser did no converting at all, and then it is the
 * supplier's own stay total rather than a rounded nightly rate multiplied back up.
 */

import { describe, it, expect } from 'vitest';
import { checkoutExpectedTotal } from '@/features/hotels/lib/checkout-money';

describe('checkoutExpectedTotal', () => {
    it('is the supplier\'s stay total when the charge currency is the supplier\'s', () => {
        expect(checkoutExpectedTotal({ price: 105.6, currency: 'USD', stayTotal: 211.2 }, 'USD', 2)).toBe('211.2');
    });

    it('falls back to the nightly rate times the nights when the rate has no stay total', () => {
        expect(checkoutExpectedTotal({ price: 120, currency: 'USD' }, 'USD', 3)).toBe('360');
    });

    it('is absent when the browser would have to convert, because the two rate sources may differ', () => {
        expect(checkoutExpectedTotal({ price: 120, currency: 'USD', stayTotal: 240 }, 'PHP', 2)).toBeUndefined();
    });

    it('compares currencies without regard to case', () => {
        expect(checkoutExpectedTotal({ price: 50, currency: 'usd', stayTotal: 100 }, 'USD', 2)).toBe('100');
    });

    it('treats a rate with no currency as USD, as everywhere else', () => {
        expect(checkoutExpectedTotal({ price: 50, stayTotal: 100 }, 'USD', 2)).toBe('100');
        expect(checkoutExpectedTotal({ price: 50, stayTotal: 100 }, 'PHP', 2)).toBeUndefined();
    });

    it('is absent for a price it cannot trust', () => {
        expect(checkoutExpectedTotal({ price: 0, currency: 'USD' }, 'USD', 2)).toBeUndefined();
        expect(checkoutExpectedTotal({ price: Number.NaN, currency: 'USD' }, 'USD', 2)).toBeUndefined();
    });

    it('never counts fewer than one night', () => {
        expect(checkoutExpectedTotal({ price: 80, currency: 'USD' }, 'USD', 0)).toBe('80');
    });

    it('rounds to two decimals, as the placeholder does', () => {
        expect(checkoutExpectedTotal({ price: 33.3333, currency: 'USD' }, 'USD', 3)).toBe('100');
    });
});
