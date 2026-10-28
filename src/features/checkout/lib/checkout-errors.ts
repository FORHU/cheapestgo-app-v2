/**
 * What went wrong at checkout, in the terms the screen reacts to.
 *
 * The API answers a refusal with `{ error: CODE, message, ...details }`, and `shared/lib/http`
 * throws it as an Error carrying `status`, `code` and the whole `body`. Until now the page read
 * one of those codes (`PRICE_CHANGED`) and showed `err.message` for the rest — so a room that
 * had sold out, a supplier that was down and a card that was declined all arrived as the same
 * red sentence, with the same single option: try again.
 *
 * They are different problems with different ways out, and this is where they are told apart:
 *
 *   price_changed        show the new price, ask   → accept it, or choose another room
 *   unavailable          the room is gone          → choose another room (retrying cannot help)
 *   quote_expired        the quote lapsed          → quietly take it again
 *   supplier_unavailable nothing is wrong with you → try again in a moment
 *
 * `CHECKOUT_ERROR_CODES` is the set of codes this maps, and mirrors the union the API documents,
 * so the two repos can be checked against one list.
 */

export const CHECKOUT_ERROR_CODES = [
    'PRICE_CHANGED',
    'UNAVAILABLE',
    'NON_MERCHANT',
    'INVALID_OFFER',
    'QUOTE_EXPIRED',
    'QUOTE_NOT_FOUND',
    'UPSTREAM_UNAVAILABLE',
    'UPSTREAM_ERROR',
    'FX_UNAVAILABLE',
    'DUPLICATE_BOOKING',
    'UNSUPPORTED_CURRENCY',
    'INVALID_AMOUNT',
    'PAYMENT_REQUIRED',
    'FORBIDDEN',
    'VALIDATION_ERROR',
    'BOOKING_NOT_FOUND',
] as const;

export type CheckoutErrorCode = (typeof CHECKOUT_ERROR_CODES)[number];

export type CheckoutFailure =
    | { kind: 'price_changed'; message: string; serverPrice?: number; currency?: string }
    | { kind: 'unavailable'; message: string }
    | { kind: 'not_payable_online'; message: string }
    | { kind: 'quote_expired'; message: string }
    | { kind: 'supplier_unavailable'; message: string; retryable: true }
    | { kind: 'duplicate'; message: string; existingBookingId?: string }
    | { kind: 'payment_required'; message: string }
    | { kind: 'validation'; message: string; fields: Record<string, string> }
    | { kind: 'unknown'; message: string };

const FALLBACK = 'Something went wrong. Please try again.';

interface HttpLikeError {
    message?: string;
    status?: number;
    code?: string;
    body?: {
        error?: string;
        message?: string;
        serverPrice?: number;
        currency?: string;
        existingBookingId?: string;
        /** The API sends zod's flattened field errors: { holder: ['Required'], ... }. An array of
         *  { path, message } is tolerated too, for a proxy that reshapes it. */
        details?: Record<string, string[] | undefined> | Array<{ path?: Array<string | number>; message?: string }>;
    };
}

function fieldsFrom(details: NonNullable<HttpLikeError['body']>['details']): Record<string, string> {
    const out: Record<string, string> = {};
    if (!details) return out;

    if (Array.isArray(details)) {
        for (const d of details) {
            if (!d?.path?.length || !d.message) continue;
            out[d.path.join('.')] = d.message;
        }
        return out;
    }

    for (const [field, messages] of Object.entries(details)) {
        const first = Array.isArray(messages) ? messages[0] : undefined;
        if (first) out[field] = first;
    }
    return out;
}

export function classifyCheckoutError(err: unknown): CheckoutFailure {
    if (typeof err === 'string') return { kind: 'unknown', message: err || FALLBACK };
    if (!err || typeof err !== 'object') return { kind: 'unknown', message: FALLBACK };

    const e = err as HttpLikeError;
    const code = e.body?.error ?? e.code;
    const message = e.body?.message ?? e.message ?? FALLBACK;

    switch (code) {
        case 'PRICE_CHANGED':
            return {
                kind: 'price_changed', message,
                ...(typeof e.body?.serverPrice === 'number' ? { serverPrice: e.body.serverPrice } : {}),
                ...(e.body?.currency ? { currency: e.body.currency } : {}),
            };
        case 'UNAVAILABLE':
            return { kind: 'unavailable', message };
        case 'NON_MERCHANT':
            return { kind: 'not_payable_online', message };
        case 'QUOTE_EXPIRED':
        case 'QUOTE_NOT_FOUND':
        case 'INVALID_OFFER':
            return { kind: 'quote_expired', message };
        case 'UPSTREAM_UNAVAILABLE':
        case 'UPSTREAM_ERROR':
        case 'FX_UNAVAILABLE':
            return { kind: 'supplier_unavailable', message, retryable: true };
        case 'DUPLICATE_BOOKING':
            return {
                kind: 'duplicate', message,
                ...(e.body?.existingBookingId ? { existingBookingId: e.body.existingBookingId } : {}),
            };
        case 'PAYMENT_REQUIRED':
            return { kind: 'payment_required', message };
        case 'VALIDATION_ERROR':
            return { kind: 'validation', message, fields: fieldsFrom(e.body?.details) };
    }

    // fetch() rejects with a TypeError when the connection never completed: nothing reached
    // the server, so there is nothing to have gone wrong with the booking.
    if (err instanceof TypeError) return { kind: 'supplier_unavailable', message, retryable: true };

    return { kind: 'unknown', message };
}

// ─── The answer to a confirm call ─────────────────────────────────────────────

export type ConfirmOutcome =
    | { kind: 'confirmed'; reference: string; status: string }
    /** Another caller is completing this booking right now. Poll its status. */
    | { kind: 'pending'; reference?: string; message: string }
    /** The supplier may hold a reservation and the payment is being kept. Do not pay again. */
    | { kind: 'needs_review'; reference?: string; message: string }
    /** `released`: the server voided the authorisation, so the traveller has not been charged. */
    | { kind: 'failed'; message: string; released: boolean };

interface ConfirmBody {
    success?: boolean;
    data?: { bookingId?: string; status?: string };
    pending?: boolean;
    needsReview?: boolean;
    providerConfirmed?: boolean;
    reference?: string;
    error?: string;
    errorCode?: string;
}

export function classifyConfirmResponse(res: unknown): ConfirmOutcome {
    const body = (res && typeof res === 'object' ? res : {}) as ConfirmBody;

    if (body.success === true && body.data?.bookingId) {
        return { kind: 'confirmed', reference: body.data.bookingId, status: body.data.status ?? 'confirmed' };
    }

    const message = body.error ?? FALLBACK;

    if (body.pending) return { kind: 'pending', reference: body.reference, message };
    if (body.needsReview) return { kind: 'needs_review', reference: body.reference, message };

    // The supplier booked, then at a price beyond what the traveller agreed to. The hold has
    // not been released and nothing was captured: a person decides, the traveller does not retry.
    if (body.errorCode === 'price_changed') {
        return {
            kind: 'needs_review', reference: body.reference,
            message: 'The price changed while we were booking. Our team will confirm the final price with you.',
        };
    }

    // Only a definitive "no" releases the money. A body that says nothing either way is not
    // grounds to tell someone they have not been charged.
    return { kind: 'failed', message, released: body.providerConfirmed === false };
}
