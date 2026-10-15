import { describe, it, expect, vi } from 'vitest';
import {
    requestQuote,
    createHotelPayment,
    confirmHotelBooking,
    fetchBookingOutcome,
    outcomeFromStatus,
    type CheckoutHttp,
} from '../hotel-checkout-api';
import type { HotelQuote } from '../hotel-checkout-machine';

function client(over: Partial<CheckoutHttp> = {}): CheckoutHttp & { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } {
    return { get: vi.fn(), post: vi.fn(), ...over } as never;
}

const STAY = {
    hotelName: 'Bayside Grand Manila', roomName: 'Standard Double Room', hotelImage: 'https://img/x.jpg',
    checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 1, currency: 'USD',
};

const GUEST = {
    holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
    holderPhone: '+63 917 123 4567',
    guests: [
        { firstName: 'Juan', lastName: 'dela Cruz' },
        { firstName: 'Maria', lastName: 'dela Cruz' },
        { firstName: '', lastName: '', age: 8 },
    ],
    specialRequests: 'High floor',
};

const QUOTE: HotelQuote = {
    prebookId: 'MOCK:abc',
    display: { currency: 'USD', subtotal: 216, taxes: 24, total: 240, serviceFee: 14, chargedTotal: 254, converted: false },
    board: 'BB',
};

describe('requestQuote', () => {
    it('asks for a quote and reads the server\'s figures, board and price change', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: {
            prebookId: 'MOCK:abc', boardCode: 'BB',
            display: QUOTE.display,
            priceChange: { previous: 240, current: 259.2, direction: 'up', currency: 'USD', difference: 19.2 },
            roomSubstituted: true, substitutedRoomName: 'Deluxe King Room',
        } });

        const q = await requestQuote(c, { rateKey: 'MOCK:offer', roomName: 'Standard Double Room', adults: 2, children: 1, currency: 'USD', expectedTotal: 240 });

        expect(c.post).toHaveBeenCalledWith('/api/hotels/prebook', {
            offerId: 'MOCK:offer', roomName: 'Standard Double Room', adults: 2, children: 1, currency: 'USD', expectedTotal: 240,
        });
        expect(q).toEqual({
            prebookId: 'MOCK:abc', display: QUOTE.display, board: 'BB',
            priceChange: { previous: 240, current: 259.2, direction: 'up', currency: 'USD', difference: 19.2 },
            roomSubstituted: true, substitutedRoomName: 'Deluxe King Room',
        });
    });

    it('does not send an expected total it was not given', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { prebookId: 'MOCK:abc', display: QUOTE.display } });

        await requestQuote(c, { rateKey: 'k', roomName: 'r', adults: 1, children: 0, currency: 'USD' });

        expect(c.post.mock.calls[0][1]).not.toHaveProperty('expectedTotal');
    });

    it('leaves the error to the caller, who classifies it', async () => {
        const c = client();
        c.post.mockRejectedValue(Object.assign(new Error('gone'), { status: 409, code: 'UNAVAILABLE' }));
        await expect(requestQuote(c, { rateKey: 'k', roomName: 'r', adults: 1, children: 0, currency: 'USD' }))
            .rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });
});

describe('createHotelPayment', () => {
    it('charges from the server\'s display figures and says who is staying', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { clientSecret: 'cs_1', paymentIntentId: 'pi_1', bookingReference: 'CG-ABC123', chargedTotal: 254, serviceFee: 14, currency: 'USD' } });

        const out = await createHotelPayment(c, { quote: QUOTE, guest: GUEST, stay: STAY, placeholderTotal: 238 });

        expect(c.post).toHaveBeenCalledWith('/api/hotels/create-payment', expect.objectContaining({
            prebookId: 'MOCK:abc',
            amount: 240,                 // display.total, never the browser's own figure
            currency: 'USD',
            displayedTotal: 254,         // what the summary showed, fee included
            holderEmail: 'juan@example.com',
            holderPhone: '+63 917 123 4567',
            holder: GUEST.holder,
            guests: GUEST.guests,
            adults: 2, children: 1,
            specialRequests: 'High floor',
            propertyName: 'Bayside Grand Manila', roomName: 'Standard Double Room',
            propertyImage: 'https://img/x.jpg',
            checkIn: '2026-11-10', checkOut: '2026-11-12',
            board: 'BB',
        }));
        expect(out).toEqual({ clientSecret: 'cs_1', paymentIntentId: 'pi_1', reference: 'CG-ABC123', chargedTotal: 254, serviceFee: 14 });
    });

    it('refuses to charge at all when the server\'s figures never arrived', async () => {
        const c = client();
        await expect(createHotelPayment(c, {
            quote: { prebookId: 'MOCK:abc' }, guest: GUEST, stay: STAY, placeholderTotal: 238,
        })).rejects.toThrow(/price/i);
        expect(c.post).not.toHaveBeenCalled();
    });
});

describe('confirmHotelBooking', () => {
    it('confirms with the payment, the quote and everything that was collected', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { bookingId: 'CG-ABC123', status: 'confirmed' } });

        const out = await confirmHotelBooking(c, {
            paymentIntentId: 'pi_1', quote: QUOTE, guest: GUEST, stay: STAY, placeholderTotal: 238,
        });

        expect(c.post).toHaveBeenCalledWith('/api/hotels/confirm', expect.objectContaining({
            paymentIntentId: 'pi_1', prebookId: 'MOCK:abc',
            holder: GUEST.holder, holderPhone: '+63 917 123 4567', guests: GUEST.guests,
            adults: 2, children: 1, board: 'BB', specialRequests: 'High floor', quotedPrice: 238,
        }));
        expect(out).toEqual({ kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' });
    });

    it('reads a non-confirmation as the outcome it is, not as an exception', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: false, needsReview: true, reference: 'CG-ABC123', error: 'unknown' });

        const out = await confirmHotelBooking(c, { paymentIntentId: 'pi_1', quote: QUOTE, guest: GUEST, stay: STAY, placeholderTotal: 0 });

        expect(out).toMatchObject({ kind: 'needs_review', reference: 'CG-ABC123' });
    });

    it('omits a quoted price it does not have', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { bookingId: 'CG-ABC123', status: 'confirmed' } });

        await confirmHotelBooking(c, { paymentIntentId: 'pi_1', quote: QUOTE, guest: GUEST, stay: STAY, placeholderTotal: 0 });

        expect(c.post.mock.calls[0][1]).not.toHaveProperty('quotedPrice');
    });
});

describe('outcomeFromStatus', () => {
    it.each([
        ['CONFIRMED', 'confirmed'],
        ['CANCEL_REQUESTED', 'confirmed'],
        ['NEEDS_REVIEW', 'needs_review'],
        ['FAILED', 'failed'],
        ['EXPIRED', 'failed'],
    ])('%s is %s', (status, kind) => {
        expect(outcomeFromStatus({ reference: 'CG-ABC123', status, bookingStatus: null, failure: null }).kind).toBe(kind);
    });

    it.each(['PAYMENT_PENDING', 'PAYMENT_AUTHORIZED', 'SUPPLIER_BOOKING'])('%s is still in flight', (status) => {
        expect(outcomeFromStatus({ reference: 'CG-ABC123', status, bookingStatus: null, failure: null }).kind).toBe('pending');
    });

    it('carries the server\'s reason for a failure and says the hold was released', () => {
        expect(outcomeFromStatus({
            reference: 'CG-ABC123', status: 'FAILED', bookingStatus: null,
            failure: { code: 'SOLD_OUT', message: 'Room is gone' },
        })).toEqual({ kind: 'failed', message: 'Room is gone', released: true });
    });

    it('falls back to the sale\'s own status for a booking from before the lifecycle', () => {
        expect(outcomeFromStatus({ reference: 'CG-OLD111', status: null, bookingStatus: 'confirmed', failure: null }).kind)
            .toBe('confirmed');
    });
});

describe('fetchBookingOutcome', () => {
    it('reads the status endpoint for a reference', async () => {
        const c = client();
        c.get.mockResolvedValue({ success: true, data: { reference: 'CG-ABC123', status: 'CONFIRMED', bookingStatus: 'confirmed', failure: null } });

        expect(await fetchBookingOutcome(c, 'CG-ABC123')).toEqual({ kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' });
        expect(c.get).toHaveBeenCalledWith('/hotels/bookings/CG-ABC123');
    });

    it('encodes a reference rather than trusting it', async () => {
        const c = client();
        c.get.mockResolvedValue({ success: true, data: { reference: 'x', status: 'CONFIRMED', bookingStatus: null, failure: null } });
        await fetchBookingOutcome(c, 'a/b?c');
        expect(c.get).toHaveBeenCalledWith('/hotels/bookings/a%2Fb%3Fc');
    });
});
