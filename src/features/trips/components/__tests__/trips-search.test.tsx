/**
 * Searching My Bookings: the field narrows every tab at once, each tab's count follows it, and a
 * search that finds nothing says so rather than claiming there are no trips.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

const get = vi.fn();

vi.mock('@/shared/lib/http', () => ({
    http: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
}));
// Stable, like the real one: the list's effect depends on the router.
const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() };
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => router,
}));

import { TripsList } from '../trips-list';

/** Rows as `bookings.listForUser` sends them. */
const HOTEL = {
    id: 'hotel-1', type: 'hotel', booking_id: 'CG-ABC123', property_name: 'Bayside Grand Manila',
    property_image: null, room_name: 'Standard Double Room',
    check_in: '2026-11-10T00:00:00.000Z', check_out: '2026-11-12T00:00:00.000Z',
    guests_adults: 2, guests_children: 0, total_price: '264', currency: 'USD', status: 'confirmed',
    holder_first_name: 'Juan', holder_last_name: 'dela Cruz', provider: 'mock', provider_metadata: {},
    cancellation_policy: { refundableTag: 'RFN', cancelPolicyInfos: [] },
    created_at: '2026-10-15T00:00:00.000Z',
};
const FLIGHT = {
    id: 'flight-1', type: 'flight', status: 'ticketed', pnr: 'QX7P2L', trip_type: 'one-way',
    total_price: '310', currency: 'USD', provider: 'duffel', created_at: '2026-10-20T00:00:00.000Z',
    flight_segments: [{
        origin: 'MNL', destination: 'ICN', departure: '2026-12-10T08:00:00', arrival: '2026-12-10T13:00:00',
        airline: 'PR', flight_number: '468', segment_index: 0,
    }],
    passengers: [{ first_name: 'Maria', last_name: 'Santos' }],
};

const wrap = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><TripsList /></NextIntlClientProvider>);

const search = () => screen.getByRole('searchbox', { name: 'Search your bookings' });
const tab = (name: RegExp) => within(screen.getByRole('group', { name: 'My Bookings' })).getByRole('button', { name });

beforeEach(() => {
    vi.clearAllMocks();
    get.mockImplementation(async (path: string) => ({ success: true, data: path.startsWith('/golf/') ? [] : [HOTEL, FLIGHT] }));
});

describe('searching my bookings', () => {
    it('narrows the list to the bookings that match', async () => {
        wrap();
        expect(await screen.findByText('Bayside Grand Manila')).toBeInTheDocument();

        fireEvent.change(search(), { target: { value: 'qx7p2l' } });

        expect(screen.queryByText('Bayside Grand Manila')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('1 booking found');
    });

    it('moves each tab\'s count with the search', async () => {
        wrap();
        await screen.findByText('Bayside Grand Manila');
        expect(tab(/^all/i)).toHaveTextContent('2');

        fireEvent.change(search(), { target: { value: 'bayside' } });

        expect(tab(/^all/i)).toHaveTextContent('1');
        expect(tab(/^hotels/i)).toHaveTextContent('1');
        expect(tab(/^flights/i)).toHaveTextContent('0');
    });

    it('says when nothing matches, and clears from there back to every booking', async () => {
        wrap();
        await screen.findByText('Bayside Grand Manila');

        fireEvent.change(search(), { target: { value: 'tokyo' } });
        expect(screen.getByRole('alert')).toHaveTextContent('No bookings match “tokyo”');
        expect(screen.queryByText(/no trips yet/i)).not.toBeInTheDocument();

        fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Clear search' }));

        expect(search()).toHaveValue('');
        expect(search()).toHaveFocus();
        expect(screen.getByText('Bayside Grand Manila')).toBeInTheDocument();
    });

    it('clears on Escape and from its own clear button', async () => {
        wrap();
        await screen.findByText('Bayside Grand Manila');

        fireEvent.change(search(), { target: { value: 'manila' } });
        fireEvent.keyDown(search(), { key: 'Escape' });
        expect(search()).toHaveValue('');

        fireEvent.change(search(), { target: { value: 'manila' } });
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(search()).toHaveValue('');
    });

    it('is not offered to an account with nothing to search', async () => {
        get.mockImplementation(async () => ({ success: true, data: [] }));
        wrap();
        expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument();
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });
});
