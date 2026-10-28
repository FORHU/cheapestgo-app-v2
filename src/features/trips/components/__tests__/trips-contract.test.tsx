/**
 * The trips screens against the response api-v2 actually sends.
 *
 * The list, the detail page and the document views each assumed a different shape — a bare
 * array, a bare booking, `{ booking }` — and none was the `{ success, data: [...] }` the API
 * returns. The cards also link by row id while the API's single-booking endpoint looks up by
 * reference. Each screen's own tests stubbed the shape the screen expected, so all of them
 * passed against an API that does not exist. This stubs the real one.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

const get = vi.fn();
const post = vi.fn();
const push = vi.fn();

vi.mock('@/shared/lib/http', () => ({
    http: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
// Stable, like the real one: the list's effect depends on the router, and a mock that hands back a
// new object every render would re-run it forever and never leave the loading state.
const router = { push, back: vi.fn(), replace: vi.fn() };

vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => router,
}));

import { TripsList } from '../trips-list';
import { BookingDetail } from '../booking-detail';

/** A hotel booking exactly as `bookings.listForUser` returns it: the raw row, plus `type`. */
const HOTEL_ROW = {
    id: '4f1c9a7e-0000-4000-8000-000000000001',
    booking_id: 'CG-ABC123',
    type: 'hotel',
    property_name: 'Bayside Grand Manila',
    property_image: null,
    room_name: 'Standard Double Room',
    check_in: '2026-11-10T00:00:00.000Z',
    check_out: '2026-11-12T00:00:00.000Z',
    guests_adults: 2,
    guests_children: 0,
    total_price: '264',
    currency: 'USD',
    status: 'confirmed',
    holder_first_name: 'Juan',
    holder_last_name: 'dela Cruz',
    holder_email: 'juan@example.com',
    special_requests: null,
    cancellation_policy: { refundableTag: 'RFN', cancelPolicyInfos: [] },
    provider: 'mock',
    provider_metadata: {},
    created_at: '2026-10-15T00:00:00.000Z',
};

const wrap = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>);

beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ success: true, data: [HOTEL_ROW] });
});

describe('the trips list', () => {
    it('shows the bookings in the API\'s envelope', async () => {
        wrap(<TripsList />);
        expect(await screen.findByText('Bayside Grand Manila')).toBeInTheDocument();
        expect(get).toHaveBeenCalledWith('/bookings');
    });

    it('says a load failed, rather than that there are no trips', async () => {
        get.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
        wrap(<TripsList />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your trips/i);
        expect(screen.queryByText(/bayside/i)).not.toBeInTheDocument();
    });

    it('can be tried again', async () => {
        get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
        wrap(<TripsList />);

        fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

        expect(await screen.findByText('Bayside Grand Manila')).toBeInTheDocument();
    });

    it('sends a signed-out traveller to sign in', async () => {
        get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
        wrap(<TripsList />);
        await waitFor(() => expect(push).toHaveBeenCalledWith('/login?next=/trips'));
    });
});

describe('a single trip', () => {
    it('opens from the row id the card links with', async () => {
        wrap(<BookingDetail id={HOTEL_ROW.id} />);

        expect(await screen.findByText('Bayside Grand Manila')).toBeInTheDocument();
        expect(screen.getByText('CG-ABC123')).toBeInTheDocument();
    });

    it('opens from the booking reference an email links with', async () => {
        wrap(<BookingDetail id="CG-ABC123" />);
        expect(await screen.findByText('Bayside Grand Manila')).toBeInTheDocument();
    });

    it('says a booking is not found when it is not one of theirs', async () => {
        wrap(<BookingDetail id="CG-SOMEONE-ELSE" />);
        expect(await screen.findByText(/booking not found/i)).toBeInTheDocument();
    });

    it('opens the cancel dialog with what comes back, and cancels nothing yet', async () => {
        get.mockImplementation(async (path: string) => {
            if (path.endsWith('/cancel-preview')) {
                return { success: true, data: {
                    reference: 'CG-ABC123', cancellable: true, status: 'confirmed',
                    paid: { amount: 264, currency: 'USD' },
                    refund: { amount: 264, currency: 'USD', type: 'full_refund', ratio: 1 },
                    penalty: { amount: 0, currency: 'USD' },
                    deadline: '2026-11-05T10:00:00.000Z', policy: 'free_cancellation', message: 'ok',
                } };
            }
            return { success: true, data: [HOTEL_ROW] };
        });
        wrap(<BookingDetail id="CG-ABC123" />);

        fireEvent.click(await screen.findByRole('button', { name: /^cancel booking$/i }));

        expect(await screen.findByRole('dialog')).toHaveAccessibleName(/cancel this booking/i);
        expect(await screen.findByRole('button', { name: /cancel and get \$264\.00 back/i })).toBeInTheDocument();
        expect(post).not.toHaveBeenCalled();
    });
});
