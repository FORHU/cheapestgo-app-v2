/**
 * Which money follows a room to checkout.
 *
 * Reported 2026-09-25: a room listed at ₩69,680 a night opened a checkout quoting PHP 3,198.
 * Roughly the same money, but the customer had no way to know that — the currency simply
 * changed under them at the moment they were asked to pay.
 *
 * The cause was the link carrying the **Supplier Currency** (what OTV quoted) rather than the
 * **Charge Currency** (what Stripe bills, which is the currency the customer chose). Those are
 * different things and the glossary keeps them apart deliberately.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkoutMoney } from '@/features/hotels/lib/checkout-money';
import { refreshExchangeRates } from '@/shared/lib/currency';
import { http } from '@/shared/lib/http';

/**
 * Rates are not live in a fresh module, which is the point of half of these tests. This puts
 * them live the only way the app does — through the endpoint — so the other half exercises the
 * converting path rather than a hand-set flag.
 */
async function withLiveRates() {
    vi.spyOn(http, 'get').mockResolvedValue({
        success: true,
        rates: { USD: 1, PHP: 0.0159203, KRW: 0.00073067 },
    } as never);
    await refreshExchangeRates();
}

describe('checkoutMoney, once the rates are in', () => {
    beforeEach(async () => { await withLiveRates(); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('carries the currency the customer is shopping in, not the supplier’s', () => {
        expect(checkoutMoney({ price: 3198, currency: 'PHP' }, 'KRW').currency).toBe('KRW');
    });

    it('converts the stay into that currency', () => {
        const { totalPrice } = checkoutMoney({ price: 3198, currency: 'PHP' }, 'KRW');
        // The figures from the report: ₱3,198 is ₩69,680 at these rates.
        expect(Number(totalPrice)).toBeCloseTo(69680, -1);
    });

    it('leaves a same-currency rate alone', () => {
        expect(checkoutMoney({ price: 120.5, currency: 'USD' }, 'USD'))
            .toEqual({ currency: 'USD', totalPrice: '120.5' });
    });

    it('treats a rate with no currency as USD rather than guessing the customer’s', () => {
        // Reading it as the charge currency would skip conversion entirely and send a supplier
        // figure under the customer's symbol — the exact bug, silently.
        expect(checkoutMoney({ price: 100, currency: null }, 'PHP').totalPrice)
            .toBe(checkoutMoney({ price: 100, currency: 'USD' }, 'PHP').totalPrice);
    });

    it('sends a plain number, because the URL is read back with parseFloat', () => {
        const { totalPrice } = checkoutMoney({ price: 1234.5678, currency: 'USD' }, 'USD');
        expect(Number.isFinite(parseFloat(totalPrice))).toBe(true);
        expect(totalPrice).not.toMatch(/[,\s]/);
    });
});
