/**
 * What checkout is handed before the exchange rates arrive.
 *
 * A file of its own because rate liveness is module state: once any test has hydrated the
 * rates they stay hydrated, and a "before they land" assertion sharing a file with an "after"
 * one silently tests the wrong branch.
 *
 * The built-in fallback is not close enough to use. PHP sits at 0.018 there against a live
 * 0.0159 — 13% — so converting with it advertises ₩76,752 for a room that costs ₩69,680, and
 * the customer meets the real figure at the payment step. Showing pesos for the second before
 * the rates land is the honest version of that.
 */

import { describe, it, expect } from 'vitest';
import { checkoutMoney } from '@/features/hotels/lib/checkout-money';
import { ratesAreLive } from '@/shared/lib/currency';

describe('checkoutMoney, before the rates are in', () => {
    it('is genuinely testing the un-hydrated branch', () => {
        // Guards the file's own premise: if something hydrates rates at import, the two tests
        // below would pass for the wrong reason.
        expect(ratesAreLive()).toBe(false);
    });

    it('sends the supplier’s own figure and currency rather than a wrong conversion', () => {
        expect(checkoutMoney({ price: 3198, currency: 'PHP' }, 'KRW'))
            .toEqual({ currency: 'PHP', totalPrice: '3198' });
    });

    it('so checkout still agrees with the page the customer just left', () => {
        // Both sides ask the same helper, so neither can convert while the other does not.
        expect(checkoutMoney({ price: 50, currency: 'USD' }, 'KRW').currency).toBe('USD');
    });
});
