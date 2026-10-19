import { describe, it, expect } from 'vitest';
import { readFlightConfirmError } from '../flight-confirm-errors';

/** What `shared/lib/http` throws for a non-2xx answer. */
const httpError = (status: number, body: Record<string, unknown>) =>
    Object.assign(new Error((body.message as string) ?? 'Request failed'), { status, code: body.error, body });

describe('readFlightConfirmError', () => {
    it('reads "still processing" as a booking to wait for, not a failure', () => {
        expect(readFlightConfirmError(httpError(409, {
            error: 'BOOKING_PROCESSING', message: 'Still confirming.', pending: true, needsReview: false, sessionId: 's1',
        }))).toEqual({ kind: 'processing', needsReview: false });
    });

    it('carries whether a person is looking at it', () => {
        expect(readFlightConfirmError(httpError(409, { error: 'BOOKING_PROCESSING', needsReview: true })))
            .toEqual({ kind: 'processing', needsReview: true });
    });

    it('reads a fare that rose after the card with both prices', () => {
        expect(readFlightConfirmError(httpError(409, {
            error: 'PRICE_CHANGED', message: 'The fare changed.', oldPrice: 100, newPrice: 140, currency: 'USD',
        }))).toEqual({ kind: 'price_changed', was: 100, now: 140, currency: 'USD' });
    });

    it('reads a price change it cannot quote as the refusal the server described', () => {
        // Relayed to a caller that lost the claim: the code and message, without the figures.
        expect(readFlightConfirmError(httpError(409, { error: 'PRICE_CHANGED', message: 'The fare changed.' })))
            .toEqual({ kind: 'refused', message: 'The fare changed.' });
    });

    it('reads a fare that sold out after the card', () => {
        expect(readFlightConfirmError(httpError(410, { error: 'OFFER_EXPIRED', message: 'Gone.' })))
            .toEqual({ kind: 'offer_expired' });
    });

    it.each(['DUFFEL_ORDER_FAILED', 'INVALID_PHONE', 'UPSTREAM_UNAVAILABLE', 'BOOKING_EXPIRED'])(
        'reads %s as a refusal whose hold is gone, in the server\'s words',
        (code) => {
            expect(readFlightConfirmError(httpError(400, { error: code, message: 'The airline said no. Your card has not been charged.' })))
                .toEqual({ kind: 'refused', message: 'The airline said no. Your card has not been charged.' });
        },
    );

    it('reads anything else as an error, which may leave the payment where it was', () => {
        expect(readFlightConfirmError(httpError(402, { error: 'PAYMENT_NOT_COMPLETED', message: 'Payment not completed.' })))
            .toEqual({ kind: 'error', message: 'Payment not completed.' });
        expect(readFlightConfirmError(new TypeError('Failed to fetch')))
            .toEqual({ kind: 'error', message: 'Failed to fetch' });
        expect(readFlightConfirmError('nonsense')).toEqual({ kind: 'error', message: '' });
    });
});
