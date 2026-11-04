import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useAuthStore } from '@/shared/auth/store';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';
import type { GolfBooking } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchGolfBooking: vi.fn(), cancelGolfBooking: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => nav,
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/features/landing/components/landing-header', () => ({ LandingHeader: () => null }));

import { GolfBookingView } from '@/features/golf/components/golf-booking-view';

const S = en.golf.booking.status;
const B = en.golf.booking;

const booking = (over: Partial<GolfBooking> = {}): GolfBooking => ({
    reference: 'CG-ABC123', teeTimeId: 'tee-1', status: 'requested', closeReason: null, players: 2, leadName: 'Pat Golfer',
    contactEmail: 'pat@example.com', currency: 'KRW', greenFee: 200000, extras: [], extrasTotal: 0, serviceFee: 4124, total: 204124,
    startsAt: '2026-11-20T00:00:00Z', holdExpiresAt: '2026-11-05T00:15:00Z', decideBy: '2026-11-07T00:00:00Z', confirmedAt: null,
    createdAt: '2026-11-05T00:00:00Z', freeCancelUntil: '2026-11-18T00:00:00Z', refundAmount: 0, cancellable: true,
    course: { slug: 'fuji', name: 'Fuji Lakeside', city: 'Gotemba', country: 'Japan', timezone: 'Asia/Tokyo', imageUrl: null },
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'u1' } as never, isLoading: false });
    useSupportWidget.setState({ openRequests: 0, draft: null });
    api.fetchGolfBooking.mockResolvedValue(booking());
    api.cancelGolfBooking.mockResolvedValue(booking({ status: 'cancelled', closeReason: 'cancelled_by_customer', cancellable: false }));
});

describe('GolfBookingView', () => {
    it('sends a signed-out visitor to sign in and back', async () => {
        useAuthStore.setState({ user: null, isLoading: false });
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(expect.stringContaining('/login?redirect=')));
        expect(api.fetchGolfBooking).not.toHaveBeenCalled();
    });

    it('says a request is not charged yet, and by when there will be an answer', async () => {
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByText(S.requested.title)).toBeInTheDocument();
        // The deadline on the course's clock: 00:00 UTC is 9:00 AM in Tokyo.
        expect(screen.getByText(/We’ll have an answer by Sat, 7 Nov 2026 9:00 AM/)).toBeInTheDocument();
        expect(screen.getByText(/authorised, not charged/)).toBeInTheDocument();
    });

    it('shows the reference, the people and the charge', async () => {
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByText('CG-ABC123')).toBeInTheDocument();
        expect(screen.getByText('Pat Golfer')).toBeInTheDocument();
        expect(screen.getByText('pat@example.com')).toBeInTheDocument();
        expect(screen.getByText('₩204,124')).toBeInTheDocument();
    });

    it('says when a booking is confirmed and charged', async () => {
        api.fetchGolfBooking.mockResolvedValueOnce(booking({ status: 'confirmed' }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByText(S.confirmed.title)).toBeInTheDocument();
    });

    it.each([
        ['expired', null, S.expired.title],
        ['declined', 'declined_by_team', S.declined.title],
        ['declined', 'not_confirmed_in_time', S.notAnswered.title],
    ] as const)('explains a booking %s (%s) and offers another time', async (status, closeReason, title) => {
        api.fetchGolfBooking.mockResolvedValueOnce(booking({ status, closeReason }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByText(title)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.golf.booking.pickAnother })).toHaveAttribute('href', '/golf/fuji');
    });

    it('offers a way back to pay for a booking still waiting on the card', async () => {
        api.fetchGolfBooking.mockResolvedValueOnce(booking({ status: 'held' }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByRole('link', { name: en.golf.booking.finishPaying }))
            .toHaveAttribute('href', '/golf/fuji/book?teeTime=tee-1&players=2');
    });

    it('keeps asking while it waits on the card, so it moves on by itself after paying', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            api.fetchGolfBooking.mockResolvedValueOnce(booking({ status: 'held' }));
            renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
            await screen.findByText(S.held.title);
            await vi.advanceTimersByTimeAsync(4100);
            expect(await screen.findByText(S.requested.title)).toBeInTheDocument();
            expect(api.fetchGolfBooking).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('says when there is no such booking', async () => {
        api.fetchGolfBooking.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 404 }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByText(en.golf.booking.missingTitle)).toBeInTheDocument();
    });

    it('offers another try on any other failure', async () => {
        api.fetchGolfBooking.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByRole('button', { name: en.golf.retry })).toBeInTheDocument();
    });
});

describe('GolfBookingView cancelling', () => {
    const open = async (over: Partial<GolfBooking> = {}) => {
        api.fetchGolfBooking.mockResolvedValue(booking(over));
        const user = userEvent.setup();
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        await screen.findByText('CG-ABC123');
        return user;
    };

    it('asks first, and does nothing if they keep the booking', async () => {
        const user = await open();
        await user.click(screen.getByRole('button', { name: B.cancelRequest }));
        expect(api.cancelGolfBooking).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: B.keepBooking }));
        expect(api.cancelGolfBooking).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: B.cancelRequest })).toBeInTheDocument();
    });

    it('says a request costs nothing to cancel, then cancels it', async () => {
        const user = await open();
        await user.click(screen.getByRole('button', { name: B.cancelRequest }));
        expect(screen.getByText(B.cancelRequestNote)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: B.confirmCancel }));
        expect(api.cancelGolfBooking).toHaveBeenCalledWith('CG-ABC123');
        expect(await screen.findByText(S.cancelled.title)).toBeInTheDocument();
        expect(screen.getByText(S.cancelled.body)).toBeInTheDocument();
    });

    it('says what comes back on a confirmed booking, to the last unit', async () => {
        const user = await open({ status: 'confirmed' });
        // The deadline on the course's clock: 00:00 UTC is 9:00 AM in Tokyo.
        expect(screen.getByText('Free cancellation until Wed, 18 Nov 2026 9:00 AM.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: B.cancelBooking }));
        expect(screen.getByText('You’ll get ₩204,124 back, the whole amount including the service fee.')).toBeInTheDocument();
    });

    it('shows what was refunded once it is cancelled', async () => {
        api.cancelGolfBooking.mockResolvedValue(booking({ status: 'cancelled', closeReason: 'cancelled_by_customer', refundAmount: 204124, cancellable: false }));
        const user = await open({ status: 'confirmed' });
        await user.click(screen.getByRole('button', { name: B.cancelBooking }));
        await user.click(screen.getByRole('button', { name: B.confirmCancel }));
        expect(await screen.findByText(/We’ve refunded ₩204,124/)).toBeInTheDocument();
    });

    it('offers support instead once free cancellation has ended, naming the booking', async () => {
        const user = await open({ status: 'confirmed', cancellable: false, freeCancelUntil: '2026-11-01T00:00:00Z' });
        expect(screen.queryByRole('button', { name: B.cancelBooking })).toBeNull();
        expect(screen.getByText('Free cancellation ended on Sun, 1 Nov 2026 9:00 AM. To change this booking, please talk to us.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: B.contactSupport }));
        expect(useSupportWidget.getState().openRequests).toBe(1);
        expect(useSupportWidget.getState().draft).toContain('CG-ABC123');
    });

    it('keeps the booking on screen and says so when the refund fails', async () => {
        api.cancelGolfBooking.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 502, code: 'REFUND_FAILED' }));
        const user = await open({ status: 'confirmed' });
        await user.click(screen.getByRole('button', { name: B.cancelBooking }));
        await user.click(screen.getByRole('button', { name: B.confirmCancel }));
        expect(await screen.findByRole('alert')).toHaveTextContent(B.cancelFailed);
        expect(screen.getByText(S.confirmed.title)).toBeInTheDocument();
    });

    it.each(['FREE_CANCELLATION_ENDED', 'BOOKING_CHANGED', 'NOT_CANCELLABLE'])('reads the booking again when told %s', async (code) => {
        api.cancelGolfBooking.mockRejectedValueOnce(Object.assign(new Error('moved'), { status: 409, code }));
        const user = await open();
        const before = api.fetchGolfBooking.mock.calls.length;
        await user.click(screen.getByRole('button', { name: B.cancelRequest }));
        api.fetchGolfBooking.mockResolvedValue(booking({ status: 'confirmed', cancellable: false }));
        await user.click(screen.getByRole('button', { name: B.confirmCancel }));
        await waitFor(() => expect(api.fetchGolfBooking.mock.calls.length).toBeGreaterThan(before));
        expect(await screen.findByText(S.confirmed.title)).toBeInTheDocument();
    });

    it('explains when the course or team cancelled, with the refund', async () => {
        await open({ status: 'cancelled', closeReason: 'cancelled_by_team', refundAmount: 204124, cancellable: false });
        expect(screen.getByText(S.cancelledByTeam.title)).toBeInTheDocument();
        expect(screen.getByText(/We’ve refunded ₩204,124/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: B.pickAnother })).toHaveAttribute('href', '/golf/fuji');
    });

    it.each(['held', 'expired', 'declined'] as const)('offers no way to cancel a booking %s', async (status) => {
        await open({ status, cancellable: false });
        expect(screen.queryByRole('button', { name: B.cancelRequest })).toBeNull();
        expect(screen.queryByRole('button', { name: B.cancelBooking })).toBeNull();
    });
});

describe('GolfBookingView extras', () => {
    const line = { code: 'cart' as const, quantity: 2, total: 50000 };

    it('shows what was added, as a line of its own', async () => {
        api.fetchGolfBooking.mockResolvedValue(booking({ status: 'requested', extras: [line], extrasTotal: 50000 }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        expect(await screen.findByText('Golf cart × 2')).toBeInTheDocument();
        expect(screen.getByText('₩50,000')).toBeInTheDocument();
    });

    it('goes back to finish paying with the same extras, so the hold is resumed rather than replaced', async () => {
        api.fetchGolfBooking.mockResolvedValue(booking({ status: 'held', extras: [line], extrasTotal: 50000 }));
        renderWithIntl(<GolfBookingView reference="CG-ABC123" />);
        const link = await screen.findByRole('link', { name: en.golf.booking.finishPaying });
        expect(link.getAttribute('href')).toContain('&extras=cart:2');
    });
});
