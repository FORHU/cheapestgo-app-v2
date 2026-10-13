/**
 * The rule these pin: a PNR is not a ticket.
 *
 * Duffel and Mystifly both return a record locator before the airline has issued
 * anything, so a document that treats a PNR as proof of a ticket sends someone to an
 * airport with a number the airline cannot act on.
 */
import { describe, it, expect } from 'vitest';
import { availableDocuments, isTicketed, pendingReason, supplierReference, ticketNumbers } from '../documents';
import type { FlightBooking, HotelBooking } from '@/shared/types';

const flight = (over: Partial<FlightBooking> = {}): FlightBooking => ({
    id: 'f1', type: 'flight', status: 'booked', total_price: 100, currency: 'USD',
    created_at: '2026-09-01T00:00:00Z', pnr: 'ABC123', ...over,
});

const hotel = (over: Partial<HotelBooking> = {}): HotelBooking => ({
    id: 'h1', type: 'hotel', status: 'confirmed', property_name: 'Example Grand',
    check_in: '2026-10-15', check_out: '2026-10-18', guests_adults: 2, guests_children: 0,
    total_price: 100, currency: 'PHP', created_at: '2026-09-01T00:00:00Z', ...over,
}) as HotelBooking;

describe('a PNR is not a ticket', () => {
    it('does not offer an e-ticket for a booking that only has a record locator', () => {
        const b = flight({ pnr: 'ABC123', status: 'booked' });
        expect(isTicketed(b)).toBe(false);
        expect(availableDocuments(b)).not.toContain('eticket');
        expect(pendingReason(b)).toBe('awaiting_ticket');
    });

    it.each([
        ['ticketed_at is set', { ticketed_at: '2026-09-01T10:00:00Z' }],
        ['a ticket number exists', { ticket_numbers: ['0011234567890'] }],
        ['the supplier says ticketed', { status: 'ticketed' as FlightBooking['status'] }],
    ])('offers one once %s', (_why, over) => {
        const b = flight(over);
        expect(isTicketed(b)).toBe(true);
        expect(availableDocuments(b)).toContain('eticket');
        expect(pendingReason(b)).toBeNull();
    });

    it('reads ticket numbers off the passengers when the row has none', () => {
        const b = flight({ passengers: [{ first_name: 'A', last_name: 'B', ticket_number: '00199' }] });
        expect(ticketNumbers(b)).toEqual(['00199']);
    });
});

describe('a receipt is not a travel document', () => {
    it('is offered for a paid booking that has no ticket yet', () => {
        expect(availableDocuments(flight({ status: 'booked' }))).toEqual(['receipt']);
    });

    it('survives cancellation, because it evidences what was charged', () => {
        const docs = availableDocuments(flight({ status: 'cancelled', ticketed_at: '2026-09-01T10:00:00Z' }));
        expect(docs).toContain('receipt');
        expect(docs).not.toContain('eticket');
    });
});

describe('the hotel voucher', () => {
    it('waits for the property to confirm', () => {
        expect(availableDocuments(hotel({ status: 'pending' as HotelBooking['status'] }))).not.toContain('voucher');
        expect(availableDocuments(hotel())).toContain('voucher');
    });

    it("leads with the supplier's reference, which is the one the front desk can find", () => {
        const b = hotel({ booking_reference: 'GG-2026-1', provider_metadata: { supplierRef: '8812-XYZ' } });
        expect(supplierReference(b)).toBe('8812-XYZ');
    });

    it('falls back to the voucher code rather than showing nothing', () => {
        expect(supplierReference(hotel({ voucher_code: 'VC-99' }))).toBe('VC-99');
        expect(supplierReference(hotel())).toBeNull();
    });
});
