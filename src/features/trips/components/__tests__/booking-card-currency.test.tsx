/**
 * The bookings page under the currency selector, and the booked flight's itinerary.
 *
 * A booking's total is what the card was charged, in the currency it was charged in — a
 * fact, and it does not move with the selector. Picking another currency in the header used
 * to change nothing on these screens at all. They now say what the confirmation screen says:
 * the amount paid, and beneath it an estimate in the currency picked, at today's rate — left
 * out until the rates are live, and when the two are the same currency.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import type { FlightBooking, HotelBooking } from '@/shared/types';

const live = vi.hoisted(() => ({ on: false, currency: 'KRW' }));
const get = vi.hoisted(() => vi.fn());

vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/shared/lib/http', () => ({ http: { get, post: vi.fn() } }));
vi.mock('@/shared/stores/search.store', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/shared/stores/search.store')>()),
    useUserCurrency: () => live.currency,
}));
vi.mock('@/shared/lib/currency', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/shared/lib/currency')>();
    return {
        ...real,
        // 1 USD = 1,400 KRW, once the rates have landed.
        ratesAreLive: () => live.on,
        convertForDisplay: (amount: number, from: string, to: string) =>
            live.on && from !== to ? { amount: amount * 1400, currency: to } : { amount, currency: from },
    };
});

import { BookingCard } from '../booking-card';
import { BookingDetail } from '../booking-detail';

const ONE_WAY: FlightBooking = {
    id: 'f1', type: 'flight', status: 'ticketed', pnr: 'ADUHJO', trip_type: 'one-way',
    total_price: 135, currency: 'USD', created_at: '2026-10-01T00:00:00.000Z',
    flight_segments: [{
        origin: 'MNL', destination: 'ICN', departure: '2026-11-26T11:21:00.000Z', arrival: '2026-11-26T15:31:00.000Z',
        airline: 'KE', flight_number: '624', segment_index: 0, cabin_class: 'economy',
    }],
};

/** As `bookings.listForUser` sends it: each leg tagged with its direction, outbound first. */
const ROUND_TRIP: FlightBooking = {
    id: 'f2', type: 'flight', status: 'ticketed', pnr: 'YUVOMV', trip_type: 'round-trip',
    total_price: 232, currency: 'USD', created_at: '2026-10-01T00:00:00.000Z',
    flight_segments: [
        {
            origin: 'MNL', destination: 'TPE', departure: '2026-12-10T22:58:00.000Z', arrival: '2026-12-11T01:05:00.000Z',
            airline: 'CI', flight_number: '702', segment_index: 0, cabin_class: 'economy', origin_terminal: '1', destination_terminal: '2',
        },
        {
            origin: 'TPE', destination: 'MNL', departure: '2026-12-17T03:00:00.000Z', arrival: '2026-12-17T05:10:00.000Z',
            airline: 'CI', flight_number: '701', segment_index: 1, cabin_class: 'economy', origin_terminal: '2', destination_terminal: null,
        },
    ],
};

const HOTEL: HotelBooking = {
    id: 'h1', type: 'hotel', status: 'confirmed', booking_id: 'CG-ABC123', property_name: 'Bayside Grand Manila',
    room_name: 'Standard Double Room', check_in: '2026-11-10T00:00:00.000Z', check_out: '2026-11-12T00:00:00.000Z',
    guests_adults: 2, guests_children: 0, total_price: 264, currency: 'USD', created_at: '2026-10-01T00:00:00.000Z',
};

const wrap = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>);

beforeEach(() => {
    live.on = false;
    live.currency = 'KRW';
    get.mockReset();
});

describe('a booking\'s total under the currency selector', () => {
    it('keeps what a flight was charged, and estimates it in the currency picked', () => {
        live.on = true;
        wrap(<BookingCard booking={ONE_WAY} />);
        expect(screen.getByText('$135')).toBeInTheDocument();
        // 135 USD × 1,400.
        expect(screen.getByText('≈ ₩189,000')).toBeInTheDocument();
    });

    it('does the same for a stay', () => {
        live.on = true;
        wrap(<BookingCard booking={HOTEL} />);
        expect(screen.getByText('$264')).toBeInTheDocument();
        expect(screen.getByText('≈ ₩369,600')).toBeInTheDocument();
    });

    it('estimates nothing until the rates are live — never a made-up figure', () => {
        wrap(<BookingCard booking={ONE_WAY} />);
        expect(screen.getByText('$135')).toBeInTheDocument();
        expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
    });

    it('estimates nothing when the currency picked is the one it was paid in', () => {
        live.on = true;
        live.currency = 'USD';
        wrap(<BookingCard booking={ONE_WAY} />);
        expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
    });

    it('carries the estimate onto the booking\'s own page', async () => {
        live.on = true;
        get.mockResolvedValue({ success: true, data: [HOTEL] });
        wrap(<BookingDetail id={HOTEL.id} />);
        // On the card at the head of the page, and again in its payment panel.
        expect((await screen.findAllByText('≈ ₩369,600')).length).toBeGreaterThan(0);
    });
});

describe('a booking\'s own page', () => {
    it('opens a flight with its itinerary already showing', async () => {
        get.mockResolvedValue({ success: true, data: [ROUND_TRIP] });
        wrap(<BookingDetail id={ROUND_TRIP.id} />);

        expect(await screen.findByText('Outbound')).toBeInTheDocument();
        expect(screen.getByText('Return')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hide flight itinerary' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not link to the page it is on', async () => {
        get.mockResolvedValue({ success: true, data: [ROUND_TRIP] });
        wrap(<BookingDetail id={ROUND_TRIP.id} />);

        await screen.findByText('Outbound');
        expect(screen.queryByRole('link', { name: /view details/i })).not.toBeInTheDocument();
        // The way back is to the list.
        expect(screen.getByRole('link', { name: 'My Bookings' })).toHaveAttribute('href', '/trips');
    });
});

describe('the booked flight\'s itinerary', () => {
    it('opens flight by flight, each direction under its own name', () => {
        wrap(<BookingCard booking={ROUND_TRIP} />);

        const toggle = screen.getByRole('button', { name: 'Show flight itinerary' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Outbound')).not.toBeInTheDocument();

        fireEvent.click(toggle);

        expect(screen.getByRole('button', { name: 'Hide flight itinerary' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Outbound')).toBeInTheDocument();
        expect(screen.getByText('Return')).toBeInTheDocument();
        // Each leg names its flight at both ends, as the results card's itinerary does.
        expect(screen.getAllByText('Economy CI 702')).toHaveLength(2);
        expect(screen.getAllByText('Economy CI 701')).toHaveLength(2);
        expect(screen.getByText('Terminal 1')).toBeInTheDocument();
    });

    it('names a round trip by where it goes, not where it ends', () => {
        wrap(<BookingCard booking={ROUND_TRIP} />);
        // Read across both directions it was MNL → MNL; the outbound is MNL → TPE.
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('MNL → TPE');
    });

    it('prints no flight time it would have to work out across time zones', () => {
        wrap(<BookingCard booking={ONE_WAY} />);
        fireEvent.click(screen.getByRole('button', { name: 'Show flight itinerary' }));
        // Each end is its own airport's clock, so the gap between them is not the time in the air.
        expect(screen.queryByText(/\dh \d+m/)).not.toBeInTheDocument();
    });
});
