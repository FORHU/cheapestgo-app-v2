/**
 * What each document is allowed to put in front of a traveller.
 *
 * These are not layout tests. Each one pins a claim the document makes to someone
 * standing at a desk: that a ticket was issued, that a property is holding a room, or
 * that money moved — and the ways those three must not be confused for one another.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import type { FlightBooking, HotelBooking } from '@/shared/types';

vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { FlightETicket, HotelVoucher, PaymentReceipt, DocumentLinks } from '../travel-documents';

const wrap = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>);

const flight = (over: Partial<FlightBooking> = {}): FlightBooking => ({
    id: 'f1', type: 'flight', status: 'ticketed', total_price: 100, currency: 'USD',
    created_at: '2026-09-01T00:00:00Z', pnr: 'BEDOCN',
    ticket_numbers: ['0011234567890'],
    flight_segments: [{ origin: 'MNL', destination: 'ICN', departure: '2026-11-28T10:40:00Z', arrival: '2026-11-28T15:30:00Z', airline: '7C', flight_number: '7C2104' }],
    passengers: [{ first_name: 'Juan', last_name: 'Dela Cruz' }],
    ...over,
});

const hotel = (over: Partial<HotelBooking> = {}): HotelBooking => ({
    id: 'h1', type: 'hotel', status: 'confirmed', property_name: 'Example Grand Hotel Seoul',
    room_name: 'Deluxe Double Room', check_in: '2026-10-15', check_out: '2026-10-18',
    guests_adults: 2, guests_children: 0, total_price: 100, currency: 'PHP',
    created_at: '2026-09-01T00:00:00Z',
    holder_first_name: 'Juan', holder_last_name: 'Dela Cruz',
    booking_reference: 'GG-2026-000456',
    provider_metadata: { supplierRef: '8812-XYZ' },
    ...over,
}) as HotelBooking;

describe('the e-ticket', () => {
    it('prints the ticket number the airline issued', () => {
        wrap(<FlightETicket booking={flight()} />);
        expect(screen.getByText('0011234567890')).toBeInTheDocument();
        expect(screen.getAllByText('BEDOCN').length).toBeGreaterThan(0);
    });

    it('sends the traveller to the airline for a boarding pass, and draws none itself', () => {
        const { container } = wrap(<FlightETicket booking={flight()} />);
        expect(screen.getByText(/check in with the airline/i)).toBeInTheDocument();
        // An invented barcode scans as nothing at a gate, so there must not be one.
        expect(container.querySelector('svg[class*="barcode"], canvas, img')).toBeNull();
        expect(container.textContent).not.toMatch(/boarding pass[^.]*\b(gate|zone|group)\b/i);
    });

    it('leaves the seat to check-in when the airline has not assigned one', () => {
        wrap(<FlightETicket booking={flight()} />);
        expect(screen.getByText(/assigned at check-in/i)).toBeInTheDocument();
    });
});

describe('the hotel voucher', () => {
    it("leads with the number the property can find, and still shows ours", () => {
        wrap(<HotelVoucher booking={hotel()} />);
        expect(screen.getAllByText('8812-XYZ').length).toBeGreaterThan(0);
        expect(screen.getByText('GG-2026-000456')).toBeInTheDocument();
    });

    it('omits the meal plan rather than guessing one', () => {
        // A guest told breakfast is included, then charged for it at the desk, is worse
        // off than a guest who was told nothing.
        wrap(<HotelVoucher booking={hotel()} />);
        expect(screen.queryByText(/meal plan/i)).not.toBeInTheDocument();

        wrap(<HotelVoucher booking={hotel({ provider_metadata: { supplierRef: 'X', board: 'Breakfast included' } })} />);
        expect(screen.getByText('Breakfast included')).toBeInTheDocument();
    });

    it('tells the guest what to bring', () => {
        wrap(<HotelVoucher booking={hotel()} />);
        expect(screen.getByText(/valid government-issued id or passport/i)).toBeInTheDocument();
    });
});

describe('the payment receipt', () => {
    it('says outright that it is not a travel document', () => {
        wrap(<PaymentReceipt booking={flight()} />);
        expect(screen.getByText(/not a travel document/i)).toBeInTheDocument();
    });

    it('shows only a masked card, never a full number', () => {
        const { container } = wrap(<PaymentReceipt booking={flight()} cardLast4="4242" />);
        expect(screen.getByText(/•••• 4242/)).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/\d{13,19}/);
    });
});

describe('which documents a booking offers', () => {
    it('offers no e-ticket, and says why, when the airline has not issued one', () => {
        wrap(<DocumentLinks booking={flight({ status: 'booked', ticket_numbers: [] })} />);
        expect(screen.queryByText(/view e-ticket/i)).not.toBeInTheDocument();
        expect(screen.getByText(/has not issued the ticket yet/i)).toBeInTheDocument();
        expect(screen.getByText(/view payment receipt/i)).toBeInTheDocument();
    });

    it('offers the e-ticket once it has', () => {
        wrap(<DocumentLinks booking={flight()} />);
        expect(screen.getByText(/view e-ticket/i)).toBeInTheDocument();
    });
});
