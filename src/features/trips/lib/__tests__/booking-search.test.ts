import { describe, it, expect } from 'vitest';
import type { FlightBooking, HotelBooking } from '@/shared/types';
import type { GolfBooking } from '@/features/golf/types';
import { bookingSearchText, golfSearchText, matchesTerms, queryTerms } from '../booking-search';

const found = (text: string, query: string) => matchesTerms(text, queryTerms(query));

const hotel = {
    id: 'h1', type: 'hotel', status: 'confirmed', property_name: 'Hotel Cebú Plaza', room_name: 'Deluxe King',
    booking_reference: 'GG-7KQ2MX', check_in: '2026-12-01', check_out: '2026-12-03', guests_adults: 2,
    guests_children: 0, total_price: 200, currency: 'USD', created_at: '2026-11-01',
    holder_first_name: 'Juan', holder_last_name: 'dela Cruz', provider_metadata: { supplierRef: 'HB-55120' },
} as HotelBooking;

const flight = {
    id: 'f1', type: 'flight', status: 'ticketed', pnr: 'ABC123', total_price: 300, currency: 'USD',
    created_at: '2026-11-02',
    flight_segments: [{ origin: 'MNL', destination: 'ICN', departure: '2026-12-10T08:00:00', airline: 'PR', flight_number: '468' }],
    passengers: [{ first_name: 'Maria', last_name: 'Santos' }],
} as FlightBooking;

const golf = {
    reference: 'GOLF-91X', leadName: 'Ken Tan',
    course: { slug: 'wack-wack', name: 'Wack Wack Golf', city: 'Mandaluyong', country: 'Philippines', timezone: 'Asia/Manila' },
} as GolfBooking;

describe('finding a booking', () => {
    it('finds a hotel by its name, ignoring case and accents', () => {
        expect(found(bookingSearchText(hotel), 'cebu')).toBe(true);
        expect(found(bookingSearchText(hotel), 'CEBÚ PLAZA')).toBe(true);
    });

    it('finds a hotel by the references it was given, and by its guest', () => {
        expect(found(bookingSearchText(hotel), 'gg-7kq2mx')).toBe(true);
        expect(found(bookingSearchText(hotel), 'HB-55120')).toBe(true);
        expect(found(bookingSearchText(hotel), 'dela cruz')).toBe(true);
    });

    it('finds a flight by its PNR, its airports, its flight number and its passengers', () => {
        const text = bookingSearchText(flight);
        expect(found(text, 'abc123')).toBe(true);
        expect(found(text, 'icn')).toBe(true);
        expect(found(text, 'PR468')).toBe(true);
        expect(found(text, 'santos')).toBe(true);
    });

    it('reads a route typed with a dash or an arrow as its two airports', () => {
        expect(queryTerms('MNL-ICN')).toEqual(['mnl', 'icn']);
        expect(queryTerms(' MNL → ICN ')).toEqual(['mnl', 'icn']);
        expect(found(bookingSearchText(flight), 'MNL-ICN')).toBe(true);
    });

    it('needs every word to match, so a second word narrows', () => {
        expect(found(bookingSearchText(flight), 'icn santos')).toBe(true);
        expect(found(bookingSearchText(flight), 'icn cebu')).toBe(false);
    });

    it('finds a golf booking by its course, its city and its reference', () => {
        const text = golfSearchText(golf);
        expect(found(text, 'wack')).toBe(true);
        expect(found(text, 'mandaluyong')).toBe(true);
        expect(found(text, 'golf-91x')).toBe(true);
    });

    it('lets everything through when nothing is typed', () => {
        expect(queryTerms('   ')).toEqual([]);
        expect(found(bookingSearchText(hotel), '')).toBe(true);
    });
});
