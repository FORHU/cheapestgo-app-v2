/**
 * What a refused `/flights/confirm` means for the flight checkout.
 *
 * The card is authorised before the airline is asked, so by the time `confirm` answers the
 * money is either held, released, or taken. The API says which:
 *
 *   processing     the airline has not settled it yet — wait, it will appear in trips. Also
 *                  what an answer that never arrived is: the order may be placed regardless
 *   price_changed  the fare rose before the airline confirmed; the hold was released
 *   offer_expired  the fare sold out before the airline confirmed; the hold was released
 *   refused        any other "no" that released the hold, in the server's own words
 *   error          anything else — the payment may be exactly where it was
 *
 * The first four leave nothing to pay with: the PaymentIntent behind the payment form is gone
 * or settled, so the page must not leave the traveller on it.
 */

export type FlightConfirmFailure =
    | { kind: 'processing'; needsReview: boolean }
    | { kind: 'price_changed'; was: number; now: number; currency: string }
    | { kind: 'offer_expired' }
    | { kind: 'refused'; message: string }
    | { kind: 'error'; message: string };

/** Refusals after which the API has released the hold (or never took one). */
const RELEASED = new Set(['PRICE_CHANGED', 'OFFER_EXPIRED', 'DUFFEL_ORDER_FAILED', 'INVALID_PHONE', 'UPSTREAM_UNAVAILABLE', 'BOOKING_EXPIRED']);

interface HttpLikeError {
    message?: string;
    code?:    string;
    status?:  number;
    body?:    { needsReview?: unknown; oldPrice?: unknown; newPrice?: unknown; currency?: unknown };
}

export function readFlightConfirmError(err: unknown): FlightConfirmFailure {
    const e = (err && typeof err === 'object' ? err : {}) as HttpLikeError;
    const message = typeof e.message === 'string' ? e.message : '';
    const body = e.body ?? {};

    if (e.code === 'BOOKING_PROCESSING') return { kind: 'processing', needsReview: body.needsReview === true };
    if (e.code === 'OFFER_EXPIRED') return { kind: 'offer_expired' };
    if (e.code === 'PRICE_CHANGED' && typeof body.oldPrice === 'number' && typeof body.newPrice === 'number') {
        return { kind: 'price_changed', was: body.oldPrice, now: body.newPrice, currency: typeof body.currency === 'string' ? body.currency : '' };
    }
    if (e.code && RELEASED.has(e.code)) return { kind: 'refused', message };

    // No answer from the API, or one from something in front of it (a proxy's 502/504, a
    // crash's bare 500): the airline can take two minutes to answer, longer than a proxy
    // waits, so the order may well be placed and the card captured. "Failed, try again" is the
    // one thing that cannot be said; the traveller is told to look in their trips instead.
    // The API's own answers always carry a code, and `http` always attaches the status.
    const noAnswer = err instanceof Error && e.status === undefined;
    const unnamedServerError = !e.code && typeof e.status === 'number' && e.status >= 500;
    if (noAnswer || unnamedServerError) return { kind: 'processing', needsReview: false };

    return { kind: 'error', message };
}
