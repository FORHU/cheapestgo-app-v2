/**
 * Decide what a hotel checkout may actually be charged.
 * Direct copy from v1's src/lib/bookings/hotelChargeBase.ts — no import changes needed.
 */

import { HOTEL_FX_DISPLAY_TOLERANCE } from '@/lib/pricing';

export interface StoredQuote {
    gross: number | string;
    currency: string;
    expires_at: string | Date;
}

export type ChargeBaseResult =
    | { ok: true; base: number; currency: string; quoteGross: number; quoteCurrency: string; drift: number; absorbed: number }
    | { ok: false; code: 'QUOTE_NOT_FOUND' | 'QUOTE_EXPIRED' | 'FX_UNAVAILABLE' | 'PRICE_CHANGED'; message: string; serverPrice?: number; currency?: string };

export function resolveHotelChargeBase(
    quote: StoredQuote | null | undefined,
    clientAmount: number,
    targetCurrency: string,
    convert: (amount: number, from: string, to: string) => number,
    now: number = Date.now(),
): ChargeBaseResult {
    if (!quote) return { ok: false, code: 'QUOTE_NOT_FOUND', message: 'This room quote is no longer valid. Please reselect your room.' };
    if (new Date(quote.expires_at).getTime() < now) return { ok: false, code: 'QUOTE_EXPIRED', message: 'This room quote has expired. Please reselect your room to get a current price.' };

    const quoteGross = Number(quote.gross);
    const quoteCurrency = String(quote.currency).toUpperCase();
    const target = targetCurrency.toUpperCase();

    if (!Number.isFinite(quoteGross) || quoteGross <= 0) return { ok: false, code: 'QUOTE_NOT_FOUND', message: 'This room quote is no longer valid. Please reselect your room.' };

    let base: number;
    if (quoteCurrency === target) {
        base = quoteGross;
    } else {
        try {
            base = convert(quoteGross, quoteCurrency, target);
        } catch {
            return { ok: false, code: 'FX_UNAVAILABLE', message: 'Currency conversion is temporarily unavailable. Please try again shortly, or switch your display currency.' };
        }
    }

    const drift = Math.abs(clientAmount - base) / base;
    if (drift > HOTEL_FX_DISPLAY_TOLERANCE) {
        return { ok: false, code: 'PRICE_CHANGED', message: 'The price has changed since you started checkout. Please review the updated total.', serverPrice: Math.round(base * 100) / 100, currency: target };
    }

    const charged = Math.min(base, clientAmount);
    return { ok: true, base: charged, currency: target, quoteGross, quoteCurrency, drift, absorbed: base - charged };
}
