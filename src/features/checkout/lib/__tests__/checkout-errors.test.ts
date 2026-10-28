import { describe, it, expect } from 'vitest';
import {
    CHECKOUT_ERROR_CODES,
    classifyCheckoutError,
    classifyConfirmResponse,
} from '../checkout-errors';

/** What `shared/lib/http` throws: an Error carrying `status`, `code` and the whole body. */
function httpError(status: number, body: Record<string, unknown>) {
    return Object.assign(new Error((body.message as string) ?? 'Request failed'), {
        status, code: body.error, body,
    });
}

describe('classifyCheckoutError', () => {
    it('reads a price that moved past what could be absorbed, with the new figure', () => {
        const out = classifyCheckoutError(httpError(409, {
            error: 'PRICE_CHANGED', message: 'The price changed', serverPrice: 259.2, currency: 'USD',
        }));
        expect(out).toEqual({ kind: 'price_changed', serverPrice: 259.2, currency: 'USD', message: 'The price changed' });
    });

    it('says a room that has gone is gone, not that something broke', () => {
        const out = classifyCheckoutError(httpError(409, { error: 'UNAVAILABLE', message: 'No longer available' }));
        expect(out.kind).toBe('unavailable');
    });

    it('separates a room that cannot be paid for online', () => {
        expect(classifyCheckoutError(httpError(409, { error: 'NON_MERCHANT', message: 'Pay at the hotel' })).kind)
            .toBe('not_payable_online');
    });

    it.each(['QUOTE_EXPIRED', 'QUOTE_NOT_FOUND', 'INVALID_OFFER'])(
        'treats %s as a quote to be taken again, not a dead end',
        (error) => {
            expect(classifyCheckoutError(httpError(400, { error, message: 'x' })).kind).toBe('quote_expired');
        },
    );

    it.each([
        [503, 'UPSTREAM_UNAVAILABLE'],
        [502, 'UPSTREAM_ERROR'],
        [503, 'FX_UNAVAILABLE'],
    ])('treats %s %s as the supplier or rates being down — retryable, nothing is wrong with the booking', (status, error) => {
        expect(classifyCheckoutError(httpError(status, { error, message: 'down' }))).toMatchObject({
            kind: 'supplier_unavailable', retryable: true,
        });
    });

    it('carries the booking a duplicate collides with', () => {
        const out = classifyCheckoutError(httpError(409, {
            error: 'DUPLICATE_BOOKING', message: 'You already have a booking', existingBookingId: 'CG-OLD111',
        }));
        expect(out).toMatchObject({ kind: 'duplicate', existingBookingId: 'CG-OLD111' });
    });

    it('maps a payment that was not authorised', () => {
        expect(classifyCheckoutError(httpError(402, { error: 'PAYMENT_REQUIRED', message: 'not authorised' })).kind)
            .toBe('payment_required');
    });

    it('turns the flattened field errors the API sends into a field map (422)', () => {
        const out = classifyCheckoutError(httpError(422, {
            error: 'VALIDATION_ERROR', message: 'Invalid request data',
            details: { holder: ['Required'], checkIn: ['Required', 'Invalid date'] },
        }));
        expect(out).toMatchObject({
            kind: 'validation',
            fields: { holder: 'Required', checkIn: 'Required' },
        });
    });

    it('also reads an array of path/message pairs', () => {
        const out = classifyCheckoutError(httpError(400, {
            error: 'VALIDATION_ERROR', message: 'Invalid input',
            details: [{ path: ['holder', 'email'], message: 'Invalid email' }, { path: ['guests', 1, 'firstName'], message: 'Required' }],
        }));
        expect(out).toMatchObject({
            kind: 'validation',
            fields: { 'holder.email': 'Invalid email', 'guests.1.firstName': 'Required' },
        });
    });

    it('treats a dropped connection as retryable', () => {
        expect(classifyCheckoutError(new TypeError('Failed to fetch'))).toMatchObject({
            kind: 'supplier_unavailable', retryable: true,
        });
    });

    it('falls back to the message it was given, and never to nothing', () => {
        expect(classifyCheckoutError(new Error('Something odd'))).toEqual({ kind: 'unknown', message: 'Something odd' });
        expect(classifyCheckoutError('nope')).toMatchObject({ kind: 'unknown' });
        expect((classifyCheckoutError(undefined) as { message: string }).message.length).toBeGreaterThan(0);
    });

    it('lists every code it knows, so both repos can be checked against the same set', () => {
        expect(CHECKOUT_ERROR_CODES).toEqual(expect.arrayContaining([
            'PRICE_CHANGED', 'UNAVAILABLE', 'NON_MERCHANT', 'QUOTE_EXPIRED', 'UPSTREAM_UNAVAILABLE', 'DUPLICATE_BOOKING',
        ]));
    });
});

describe('classifyConfirmResponse', () => {
    it('is a confirmed booking with its reference', () => {
        expect(classifyConfirmResponse({ success: true, data: { bookingId: 'CG-ABC123', status: 'confirmed' } }))
            .toEqual({ kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' });
    });

    it('is pending — not failed — while another caller completes the booking', () => {
        const out = classifyConfirmResponse({
            success: false, pending: true, reference: 'CG-ABC123', error: 'still being confirmed',
        });
        expect(out).toMatchObject({ kind: 'pending', reference: 'CG-ABC123' });
    });

    it('asks for review, and says do not pay again, when the supplier outcome is unknown', () => {
        const out = classifyConfirmResponse({
            success: false, needsReview: true, providerConfirmed: false, reference: 'CG-ABC123', error: 'no answer',
        });
        expect(out).toMatchObject({ kind: 'needs_review', reference: 'CG-ABC123' });
    });

    it('treats a booking made but not paid for as review, never as a failure to retry', () => {
        const out = classifyConfirmResponse({
            success: false, providerConfirmed: true, needsReview: true, reference: 'CG-ABC123', error: 'payment',
        });
        expect(out.kind).toBe('needs_review');
    });

    it('says the hold was released on a definitive refusal', () => {
        const out = classifyConfirmResponse({ success: false, providerConfirmed: false, error: 'Room is gone' });
        expect(out).toEqual({ kind: 'failed', message: 'Room is gone', released: true });
    });

    it('does not claim money was released when it cannot know', () => {
        const out = classifyConfirmResponse({ success: false, error: 'Booking failed' });
        expect(out).toMatchObject({ kind: 'failed', released: false });
    });

    it('is a price change after the fact when the supplier booked at a higher price', () => {
        const out = classifyConfirmResponse({ success: false, errorCode: 'price_changed', oldPrice: 100, newPrice: 130 });
        expect(out).toMatchObject({ kind: 'needs_review' });
    });

    it('never throws on a body it does not recognise', () => {
        expect(classifyConfirmResponse(null)).toMatchObject({ kind: 'failed' });
        expect(classifyConfirmResponse({})).toMatchObject({ kind: 'failed' });
    });
});
