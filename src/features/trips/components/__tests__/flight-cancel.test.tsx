/**
 * A flight's own page against the API's cancel endpoints: cancelling it from here, and a
 * cancellation made at Duffel (dashboard or airline) showing up when the page opens.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

const get = vi.fn();
const post = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock('@/shared/lib/http', () => ({
    http: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
vi.mock('sonner', () => ({ toast }));
const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() };
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => router,
}));

import { BookingDetail } from '../booking-detail';

/** A flight booking as `bookings.listForUser` returns it: the raw row, plus `type`. */
const FLIGHT_ROW = {
    id: '7d2e0c1a-0000-4000-8000-000000000002',
    type: 'flight',
    status: 'ticketed',
    pnr: 'XK4P2Q',
    provider: 'duffel',
    total_price: '100.00',
    charged_price: '102.50',
    currency: 'USD',
    created_at: '2026-10-15T00:00:00.000Z',
    flight_segments: [],
    passengers: [{ first_name: 'Juan', last_name: 'dela Cruz', type: 'adult' }],
};

let row: Record<string, unknown>;

const wrap = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>);

beforeEach(() => {
    vi.clearAllMocks();
    row = { ...FLIGHT_ROW };
    get.mockImplementation(async (path: string) => ({ success: true, data: path.startsWith('/golf/') ? [] : [row] }));
    post.mockImplementation(async (path: string) => {
        if (path === '/flights/refresh-status') return { status: row.status, changed: false };
        if (path === '/flights/cancel-quote') {
            return { success: true, refundAmount: 102.5, refundCurrency: 'USD', penaltyAmount: 0, cancellationId: 'ore_1' };
        }
        throw new Error(`unexpected POST ${path}`);
    });
});

async function cancelThroughTheModal() {
    fireEvent.click(await screen.findByRole('button', { name: /^cancel booking$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm cancellation/i }));
}

describe('a flight cancelled at Duffel', () => {
    it('asks the API to check with Duffel when the page opens', async () => {
        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        await waitFor(() => expect(post).toHaveBeenCalledWith('/flights/refresh-status', { bookingId: FLIGHT_ROW.id }));
    });

    it('shows the cancellation once the API has settled it, and offers no cancel', async () => {
        post.mockImplementation(async (path: string) => {
            if (path === '/flights/refresh-status') {
                row = { ...row, status: 'refunded' };
                return { status: 'refunded', changed: true };
            }
            throw new Error(`unexpected POST ${path}`);
        });

        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        expect((await screen.findAllByText('Refunded')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /^cancel booking$/i })).not.toBeInTheDocument();
    });

    it('does not ask about a flight already cancelled here', async () => {
        row = { ...row, status: 'refunded' };
        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        expect((await screen.findAllByText('Refunded')).length).toBeGreaterThan(0);
        expect(post).not.toHaveBeenCalled();
    });
});

describe('cancelling a flight from its page', () => {
    it('is offered for a confirmed flight not yet ticketed', async () => {
        row = { ...row, status: 'confirmed' };
        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        expect(await screen.findByRole('button', { name: /^cancel booking$/i })).toBeInTheDocument();
    });

    it('says a flight cancelled at Duffel is already cancelled, rather than "unable to proceed"', async () => {
        // The page's check on open was still settling it when the traveller pressed cancel.
        post.mockImplementation(async (path: string) => {
            if (path === '/flights/refresh-status') return { status: 'ticketed', changed: false };
            if (path === '/flights/cancel-quote') {
                row = { ...row, status: 'refunded' };
                return { success: false, alreadyCancelled: true, status: 'refunded' };
            }
            throw new Error(`unexpected POST ${path}`);
        });
        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        fireEvent.click(await screen.findByRole('button', { name: /^cancel booking$/i }));

        expect(await screen.findByText(/already been cancelled/i)).toBeInTheDocument();
        expect(screen.getByText(/refund has been issued/i)).toBeInTheDocument();
        expect(screen.queryByText(/unable to proceed/i)).not.toBeInTheDocument();
        // The page behind the dialog catches up.
        expect((await screen.findAllByText('Refunded')).length).toBeGreaterThan(0);
    });

    it('says so when the airline refused, rather than reporting success', async () => {
        const quote = post.getMockImplementation()!;
        post.mockImplementation(async (path: string, body: unknown) => {
            if (path === '/flights/cancel-booking') return { status: 'cancel_failed', requiresManualCancellation: true };
            return quote(path, body);
        });
        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        await cancelThroughTheModal();

        expect(await screen.findByText(/contact (support|customer service)/i)).toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('reports a completed cancellation and its refund', async () => {
        const quote = post.getMockImplementation()!;
        post.mockImplementation(async (path: string, body: unknown) => {
            if (path === '/flights/cancel-booking') {
                row = { ...row, status: 'refunded' };
                return { status: 'refunded', refundAmount: 102.5, refundCurrency: 'USD' };
            }
            return quote(path, body);
        });
        wrap(<BookingDetail id={FLIGHT_ROW.id} />);

        await cancelThroughTheModal();

        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(post).toHaveBeenCalledWith('/flights/cancel-booking', { bookingId: FLIGHT_ROW.id, cancellationId: 'ore_1' });
        expect((await screen.findAllByText('Refunded')).length).toBeGreaterThan(0);
    });
});
