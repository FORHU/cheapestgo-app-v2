/**
 * Capture the exchange rate a booking was taken at.
 * Ported from v1's src/lib/bookings/fxLock.ts.
 * Uses server currency module (no HTTP round-trip to /api/exchange-rates).
 */

import { EXCHANGE_RATES, refreshExchangeRates } from '@/server/currency';

export interface FxLock {
    usd_amount: number | null;
    fx_rate: number | null;
    fx_captured_at: string | null;
    fx_source: string | null;
}

const EMPTY: FxLock = { usd_amount: null, fx_rate: null, fx_captured_at: null, fx_source: null };

export async function lockFx(amount: number | null | undefined, currency: string | null | undefined): Promise<FxLock> {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || !currency) return EMPTY;
    const ccy = String(currency).toUpperCase();
    const now = new Date().toISOString();
    if (ccy === 'USD') return { usd_amount: amount, fx_rate: 1, fx_captured_at: now, fx_source: 'identity' };
    try {
        await refreshExchangeRates();
        const rate = EXCHANGE_RATES[ccy];
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
            console.warn(`[fxLock] No rate for ${ccy} — booking recorded unconverted`);
            return EMPTY;
        }
        return { usd_amount: amount * rate, fx_rate: rate, fx_captured_at: now, fx_source: 'live' };
    } catch (err) {
        console.error('[fxLock] Rate capture failed:', err);
        return EMPTY;
    }
}
