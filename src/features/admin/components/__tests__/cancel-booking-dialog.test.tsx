import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Booking } from '@/shared/types';

/**
 * Cancelling a booking for a customer (ADR-0004 in api-v2).
 *
 * The agent is about to tell someone a number, so the figure comes first and the action second.
 * These tests hold the parts of that which are easy to lose: the refund shown is the refund the
 * policy allows, an override is a deliberate act that has to be explained, and a supplier refusal
 * is reported as "nothing happened" rather than swallowed.
 */

const api = vi.hoisted(() => ({
    hotelPreview: vi.fn(),
    cancelHotel:  vi.fn(),
    flightQuote:  vi.fn(),
    cancelFlight: vi.fn(),
}));
vi.mock('@/features/admin/api/cancellations.api', () => ({ adminCancellationsApi: api }));

import { CancelBookingDialog } from '@/features/admin/components/cancel-booking-dialog';

const hotelBooking: Booking = {
    id: 'hb-1', userId: 'u-1', type: 'hotel', status: 'confirmed',
    totalAmount: 1000, currency: 'PHP', createdAt: '2026-10-26T09:14:00Z', reference: 'CG-ABC123',
};

const flightBooking: Booking = {
    id: 'fb-1', userId: 'u-1', type: 'flight', status: 'confirmed',
    totalAmount: 500, currency: 'USD', createdAt: '2026-10-26T09:14:00Z', reference: 'CG-FLY999',
};

const preview = (over: Record<string, unknown> = {}) => ({
    success: true,
    data: {
        reference: 'CG-ABC123', refundable: true, refundAmount: 600, penaltyAmount: 400,
        currency: 'PHP', refundType: 'partial_refund',
        message: 'Half the stay is kept after the free-cancellation deadline.',
        ...over,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    api.hotelPreview.mockResolvedValue(preview());
    api.cancelHotel.mockResolvedValue({ success: true, data: { bookingId: 'CG-ABC123', status: 'cancelled_refunded', message: 'Booking cancelled and refund processed.' } });
    api.flightQuote.mockResolvedValue({ success: true, refundAmount: 400, refundCurrency: 'USD', penaltyAmount: 100, cancellationId: 'can_1' });
    api.cancelFlight.mockResolvedValue({ success: true, status: 'refunded', refundAmount: 400 });
});

const open = (booking: Booking = hotelBooking) =>
    render(<CancelBookingDialog booking={booking} onClose={vi.fn()} onDone={vi.fn()} />);

describe('before anything is cancelled', () => {
    it('shows what the recorded terms return, and what the hotel keeps', async () => {
        open();

        expect(await screen.findByText('PHP 600.00')).toBeInTheDocument();
        expect(screen.getByText('PHP 400.00')).toBeInTheDocument();
        expect(screen.getByText(/Penalty kept by the hotel/)).toBeInTheDocument();
        expect(screen.getByText(/free-cancellation deadline/)).toBeInTheDocument();
    });

    /** The agent should be able to read the number off the button they are about to press. */
    it('names the amount on the button itself', async () => {
        open();

        expect(await screen.findByRole('button', { name: 'Cancel and refund PHP 600.00' })).toBeInTheDocument();
    });

    it('asks the airline what it returns, for a flight', async () => {
        open(flightBooking);

        await waitFor(() => expect(api.flightQuote).toHaveBeenCalledWith('fb-1'));
        expect(await screen.findByText('USD 400.00')).toBeInTheDocument();
    });

    /** A supplier that will not price it is not an error, and the agent can still act. */
    it('says the airline would not price it rather than showing a blank', async () => {
        api.flightQuote.mockResolvedValue({ success: false, noQuote: true });
        open(flightBooking);

        expect(await screen.findByText(/would not price this cancellation/)).toBeInTheDocument();
    });

    /**
     * The order the cancellation runs in, stated where the agent will read it. They are about to
     * promise a refund, and the supplier can still say no.
     */
    it('warns that a supplier refusal leaves the booking untouched', async () => {
        open();

        expect(await screen.findByText(/If they refuse, nothing is refunded/)).toBeInTheDocument();
    });
});

describe('the override', () => {
    it('restates the button as the whole charge once it is ticked', async () => {
        const user = userEvent.setup();
        open();
        await screen.findByText('PHP 600.00');

        await user.click(screen.getByLabelText(/Refund the whole charge anyway/));

        expect(await screen.findByRole('button', { name: 'Cancel and refund PHP 1,000.00' })).toBeInTheDocument();
    });

    /**
     * On a non-refundable stay the supplier still bills us, so an override is a loss somebody
     * chose. A reason is the difference between a decision and an accident, and it is the only
     * thing a reader will have months later.
     */
    it('will not let an override through without a reason', async () => {
        const user = userEvent.setup();
        open();
        await screen.findByText('PHP 600.00');

        await user.click(screen.getByLabelText(/Refund the whole charge anyway/));
        expect(screen.getByRole('button', { name: /Cancel and refund/ })).toBeDisabled();

        await user.type(screen.getByLabelText(/Reason/), 'supplier double-charged us');
        expect(screen.getByRole('button', { name: /Cancel and refund/ })).toBeEnabled();
    });

    it('sends the override and the reason to the server', async () => {
        const user = userEvent.setup();
        open();
        await screen.findByText('PHP 600.00');

        await user.click(screen.getByLabelText(/Refund the whole charge anyway/));
        await user.type(screen.getByLabelText(/Reason/), 'goodwill');
        await user.click(screen.getByRole('button', { name: /Cancel and refund/ }));

        await waitFor(() => expect(api.cancelHotel).toHaveBeenCalledWith('CG-ABC123', {
            refundInFull: true, reason: 'goodwill',
        }));
    });

    /** A flight refund is whatever the airline gave back; there is no local policy to override. */
    it('is not offered for a flight', async () => {
        open(flightBooking);
        await screen.findByText('USD 400.00');

        expect(screen.queryByLabelText(/Refund the whole charge anyway/)).toBeNull();
    });

    it('is off by default, so the policy applies unless somebody says otherwise', async () => {
        const user = userEvent.setup();
        open();
        await screen.findByText('PHP 600.00');

        await user.click(screen.getByRole('button', { name: /Cancel and refund/ }));

        await waitFor(() => expect(api.cancelHotel).toHaveBeenCalledWith('CG-ABC123', {
            refundInFull: false, reason: undefined,
        }));
    });
});

describe('when it goes wrong', () => {
    /**
     * The supplier refusing is the case that matters: the customer has not been refunded and
     * their booking still stands. Showing a generic failure would leave the agent guessing.
     */
    it('shows the service\'s own message when the supplier refuses', async () => {
        const user = userEvent.setup();
        api.cancelHotel.mockRejectedValue(new Error('The hotel did not accept the cancellation, so your booking has not changed and you have not been refunded.'));
        open();
        await screen.findByText('PHP 600.00');

        await user.click(screen.getByRole('button', { name: /Cancel and refund/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('has not changed and you have not been refunded');
    });

    it('says so when the refund figure could not be worked out at all', async () => {
        api.hotelPreview.mockRejectedValue(new Error('Booking not found'));
        open();

        expect(await screen.findByRole('alert')).toHaveTextContent('Booking not found');
    });

    /** Once it has gone through, there is nothing left to press. */
    it('reports what happened and withdraws the button', async () => {
        const user = userEvent.setup();
        open();
        await screen.findByText('PHP 600.00');

        await user.click(screen.getByRole('button', { name: /Cancel and refund/ }));

        expect(await screen.findByText('Booking cancelled and refund processed.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cancel and refund/ })).toBeNull();
    });
});
