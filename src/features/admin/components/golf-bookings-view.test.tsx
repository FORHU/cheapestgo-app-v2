import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminGolfBooking } from '@/features/golf/types';

const api = vi.hoisted(() => ({ listBookings: vi.fn(), confirmBooking: vi.fn(), declineBooking: vi.fn(), cancelBooking: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => ({ adminGolfApi: api }));

import { GolfBookingsView } from '@/features/admin/components/golf-bookings-view';

const booking = (over: Partial<AdminGolfBooking> = {}): AdminGolfBooking => ({
    id: 'b-1', reference: 'CG-ABC123', teeTimeId: 'tee-1', status: 'requested', closeReason: null, players: 2,
    leadName: 'Pat Golfer', contactEmail: 'pat@example.com', currency: 'KRW', greenFee: 200000, extras: [], extrasTotal: 0, serviceFee: 4124, total: 204124,
    freeCancelUntil: '2026-11-18T00:00:00Z', refundAmount: 0,
    courseCurrency: 'JPY', pricePerPlayer: 12000, requestedAt: '2026-11-05T00:00:00Z', closedAt: null, createdAt: '2026-11-05T00:00:00Z',
    startsAt: '2026-11-20T00:00:00Z', holdExpiresAt: '2026-11-05T00:15:00Z', decideBy: '2099-11-07T00:00:00Z', confirmedAt: null,
    course: { slug: 'fuji', name: 'Fuji Lakeside', city: 'Gotemba', country: 'Japan', timezone: 'Asia/Tokyo', imageUrl: null },
    ...over,
});

const page = (data: AdminGolfBooking[]) => ({ data, total: data.length, page: 1, pageSize: 25, totalPages: 1 });

let confirm: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    vi.clearAllMocks();
    api.listBookings.mockResolvedValue(page([booking()]));
    api.confirmBooking.mockResolvedValue(booking({ status: 'confirmed' }));
    api.declineBooking.mockResolvedValue(booking({ status: 'declined' }));
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => confirm.mockRestore());

describe('GolfBookingsView extras', () => {
    it('says what to arrange, and counts it in what the course is owed', async () => {
        api.listBookings.mockResolvedValue({
            data: [booking({ extras: [{ code: 'caddie', quantity: 2, unitPrice: 4000, total: 68000 }], extrasTotal: 68000 })],
            total: 1, page: 1, pageSize: 25, totalPages: 1,
        });
        render(<GolfBookingsView />);
        expect(await screen.findByText('Caddie × 2')).toBeInTheDocument();
        expect(screen.getByText(/Course: ¥32,000/)).toBeInTheDocument();
    });
});

describe('GolfBookingsView', () => {
    it('opens on what is waiting, with the charge and what the course asks', async () => {
        render(<GolfBookingsView />);
        const row = (await screen.findByText('Fuji Lakeside')).closest('tr')!;
        expect(api.listBookings).toHaveBeenCalledWith('waiting', 1);
        expect(within(row).getByText('CG-ABC123')).toBeInTheDocument();
        expect(within(row).getByText('₩204,124')).toBeInTheDocument();
        // 12,000 a player, two players, in the course's own currency.
        expect(within(row).getByText('Course: ¥24,000')).toBeInTheDocument();
        // On the course's clock: 00:00 UTC is 9:00 AM in Tokyo.
        expect(within(row).getByText('9:00 AM')).toBeInTheDocument();
    });

    it('confirms only after saying what it will charge, then reloads', async () => {
        const user = userEvent.setup();
        render(<GolfBookingsView />);
        await user.click(await screen.findByRole('button', { name: /Confirm/ }));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('₩204,124'));
        expect(api.confirmBooking).toHaveBeenCalledWith('CG-ABC123');
        await waitFor(() => expect(api.listBookings).toHaveBeenCalledTimes(2));
    });

    it('does nothing when the confirmation is called off', async () => {
        confirm.mockReturnValue(false);
        const user = userEvent.setup();
        render(<GolfBookingsView />);
        await user.click(await screen.findByRole('button', { name: /Confirm/ }));
        expect(api.confirmBooking).not.toHaveBeenCalled();
    });

    it('declines after saying nothing is charged', async () => {
        const user = userEvent.setup();
        render(<GolfBookingsView />);
        await user.click(await screen.findByRole('button', { name: /Decline/ }));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('nothing is charged'));
        expect(api.declineBooking).toHaveBeenCalledWith('CG-ABC123');
    });

    it("shows why an answer failed, naming the booking and Stripe's reason", async () => {
        api.confirmBooking.mockRejectedValueOnce(new Error('Your card was declined'));
        const user = userEvent.setup();
        render(<GolfBookingsView />);
        await user.click(await screen.findByRole('button', { name: /Confirm/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('CG-ABC123: Your card was declined');
    });

    it('offers answers only on the waiting list', async () => {
        const user = userEvent.setup();
        render(<GolfBookingsView />);
        await screen.findByRole('button', { name: /Confirm/ });

        api.listBookings.mockResolvedValueOnce(page([booking({ status: 'declined', closeReason: 'not_confirmed_in_time' })]));
        await user.click(screen.getByRole('tab', { name: 'Closed' }));
        expect(await screen.findByText('No answer in time')).toBeInTheDocument();
        expect(api.listBookings).toHaveBeenLastCalledWith('closed', 1);
        expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
    });

    it('says so when a list is empty, and when it cannot load', async () => {
        api.listBookings.mockResolvedValueOnce(page([]));
        const { unmount } = render(<GolfBookingsView />);
        expect(await screen.findByText('Nothing here.')).toBeInTheDocument();
        unmount();

        api.listBookings.mockRejectedValueOnce(new Error('Forbidden'));
        render(<GolfBookingsView />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    });

    describe('cancelling a confirmed booking', () => {
        const toUpcoming = async () => {
            const user = userEvent.setup();
            render(<GolfBookingsView />);
            await screen.findByRole('button', { name: /Confirm/ });
            api.listBookings.mockResolvedValue(page([booking({ status: 'confirmed' })]));
            await user.click(screen.getByRole('tab', { name: 'Upcoming' }));
            await screen.findByRole('button', { name: /Cancel & refund/ });
            return user;
        };

        it('says what it will refund, cancels, and reloads', async () => {
            api.cancelBooking.mockResolvedValue(booking({ status: 'cancelled', refundAmount: 204124 }));
            const user = await toUpcoming();
            const before = api.listBookings.mock.calls.length;
            await user.click(screen.getByRole('button', { name: /Cancel & refund/ }));
            expect(confirm).toHaveBeenCalledWith(expect.stringContaining('₩204,124'));
            expect(api.cancelBooking).toHaveBeenCalledWith('CG-ABC123');
            await waitFor(() => expect(api.listBookings.mock.calls.length).toBeGreaterThan(before));
        });

        it('does nothing when called off', async () => {
            const user = await toUpcoming();
            confirm.mockReturnValue(false);
            await user.click(screen.getByRole('button', { name: /Cancel & refund/ }));
            expect(api.cancelBooking).not.toHaveBeenCalled();
        });

        it('shows why a refund failed', async () => {
            api.cancelBooking.mockRejectedValueOnce(new Error('The refund could not be made.'));
            const user = await toUpcoming();
            await user.click(screen.getByRole('button', { name: /Cancel & refund/ }));
            expect(await screen.findByRole('alert')).toHaveTextContent('CG-ABC123: The refund could not be made.');
        });

        it('offers no Confirm or Decline on a confirmed booking', async () => {
            await toUpcoming();
            expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull();
            expect(screen.queryByRole('button', { name: /Decline/ })).toBeNull();
        });
    });

    it('shows who cancelled a closed booking and what went back', async () => {
        const user = userEvent.setup();
        render(<GolfBookingsView />);
        await screen.findByRole('button', { name: /Confirm/ });
        api.listBookings.mockResolvedValue(page([booking({ status: 'cancelled', closeReason: 'cancelled_by_customer', refundAmount: 204124 })]));
        await user.click(screen.getByRole('tab', { name: 'Closed' }));
        expect(await screen.findByText('Cancelled by the customer')).toBeInTheDocument();
        expect(screen.getByText('Refunded ₩204,124')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cancel & refund/ })).toBeNull();
    });
});
