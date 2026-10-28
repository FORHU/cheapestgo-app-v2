import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { HotelCancelModal } from '../hotel-cancel-modal';
import type { CancelHttp, CancelPreview } from '../../lib/hotel-cancel';

const PARTIAL: CancelPreview = {
    reference: 'CG-ABC123', cancellable: true, status: 'confirmed',
    paid:    { amount: 264, currency: 'USD' },
    refund:  { amount: 132, currency: 'USD', type: 'partial_refund', ratio: 0.5 },
    penalty: { amount: 132, currency: 'USD' },
    deadline: '2026-11-05T10:00:00.000Z',
    policy: 'standard',
    message: 'Cancelling now incurs a penalty.',
};

const FULL: CancelPreview = {
    ...PARTIAL,
    refund:  { amount: 264, currency: 'USD', type: 'full_refund', ratio: 1 },
    penalty: { amount: 0, currency: 'USD' },
};

const NONE: CancelPreview = {
    ...PARTIAL,
    refund:  { amount: 0, currency: 'USD', type: 'no_refund', ratio: 0 },
    penalty: { amount: 264, currency: 'USD' },
    deadline: null,
};

const ok = (data: unknown) => ({ success: true, data });

function setup(preview: CancelPreview | Error, post?: (path: string, body: unknown) => unknown) {
    const client = {
        get: vi.fn(async () => { if (preview instanceof Error) throw preview; return ok(preview); }),
        post: vi.fn(async (p: string, b: unknown) => (post ? post(p, b) : ok({ bookingId: 'CG-ABC123', status: 'cancelled_refunded', message: 'ok' }))),
    } as unknown as CancelHttp & { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

    const onClose = vi.fn();
    const onDone = vi.fn();
    render(
        <NextIntlClientProvider locale="en" messages={en as never}>
            <HotelCancelModal reference="CG-ABC123" propertyName="Bayside Grand" client={client} onClose={onClose} onDone={onDone} />
        </NextIntlClientProvider>,
    );
    return { client, onClose, onDone };
}

beforeEach(() => vi.clearAllMocks());

describe('showing what you would get back', () => {
    it('says what was paid, the fee and the refund before offering anything', async () => {
        setup(PARTIAL);

        expect(screen.getByRole('dialog')).toHaveAccessibleName(/cancel this booking/i);
        expect(await screen.findByText(/get part of your payment back/i)).toBeInTheDocument();
        expect(screen.getByText('$264.00')).toBeInTheDocument();
        expect(screen.getAllByText('$132.00').length).toBeGreaterThanOrEqual(2);
    });

    it('says when the terms get worse', async () => {
        setup(PARTIAL);
        expect(await screen.findByText(/the fee goes up on november 5, 2026/i)).toBeInTheDocument();
    });

    it('says when a full refund stops', async () => {
        setup({ ...FULL, policy: 'free_cancellation' });
        expect(await screen.findByText(/refunded in full/i)).toBeInTheDocument();
        expect(screen.getByText(/free to cancel until november 5, 2026/i)).toBeInTheDocument();
    });

    it('names the amount on the button that cancels', async () => {
        setup(FULL);
        expect(await screen.findByRole('button', { name: /cancel and get \$264\.00 back/i })).toBeInTheDocument();
    });

    it('is blunt when nothing comes back, and the button says so too', async () => {
        setup(NONE);
        expect(await screen.findByText(/won't get anything back/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel anyway — no refund/i })).toBeInTheDocument();
    });

    it('cancels nothing by opening', async () => {
        const { client } = setup(PARTIAL);
        await screen.findByText(/get part of your payment back/i);
        expect(client.post).not.toHaveBeenCalled();
    });
});

describe('cancelling', () => {
    it('cancels the booking and says the refund is on its way', async () => {
        const { client, onDone } = setup(FULL);
        fireEvent.click(await screen.findByRole('button', { name: /cancel and get/i }));

        expect(await screen.findByText(/refund is on its way/i)).toBeInTheDocument();
        expect(client.post).toHaveBeenCalledWith('/hotels/cancel', { bookingRef: 'CG-ABC123' });
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled_refunded', refunded: true }));
    });

    it('cancels once however many times the button is pressed', async () => {
        const { client } = setup(FULL);
        const button = await screen.findByRole('button', { name: /cancel and get/i });

        fireEvent.click(button);
        fireEvent.click(button);
        await screen.findByText(/refund is on its way/i);

        expect(client.post).toHaveBeenCalledTimes(1);
    });

    it('says plainly when it was cancelled but the refund did not go through', async () => {
        setup(FULL, () => ok({ bookingId: 'CG-ABC123', status: 'cancelled_refund_failed', message: 'x' }));
        fireEvent.click(await screen.findByRole('button', { name: /cancel and get/i }));

        expect(await screen.findByText(/refund didn't go through/i)).toBeInTheDocument();
    });

    it('does not cancel on a figure that has moved, and shows the new one', async () => {
        const { client } = setup(FULL);
        const button = await screen.findByRole('button', { name: /cancel and get \$264/i });

        // Between opening the dialog and confirming, a penalty tier began.
        client.get.mockResolvedValue(ok(NONE));
        fireEvent.click(button);

        expect(await screen.findByText(/the amount has changed/i)).toBeInTheDocument();
        expect(client.post).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /cancel anyway — no refund/i })).toBeInTheDocument();
    });

    it('lets the traveller confirm again on the new figure', async () => {
        const { client } = setup(FULL);
        const first = await screen.findByRole('button', { name: /cancel and get/i });
        client.get.mockResolvedValue(ok(NONE));
        fireEvent.click(first);
        fireEvent.click(await screen.findByRole('button', { name: /cancel anyway/i }));

        await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
    });

    it('reports a failed cancellation and lets it be tried again', async () => {
        const { client } = setup(FULL, () => { throw Object.assign(new Error('boom'), { status: 500 }); });
        fireEvent.click(await screen.findByRole('button', { name: /cancel and get/i }));

        expect(await screen.findByText(/couldn't cancel this booking/i)).toBeInTheDocument();
        expect(client.post).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: /cancel and get/i })).toBeEnabled();
    });
});

describe('when it cannot be cancelled', () => {
    it('says a cancelled booking is cancelled, and offers only to close', async () => {
        setup({ ...PARTIAL, cancellable: false, reason: 'already_cancelled' });

        expect(await screen.findByText(/already been cancelled/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /cancel and get|cancel anyway|cancel booking/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('explains a refund that is being retried', async () => {
        setup({ ...FULL, status: 'cancelled_refund_failed', reason: 'refund_retry' });
        expect(await screen.findByText(/already cancelled, but the refund didn't go through/i)).toBeInTheDocument();
    });

    it('says so when the terms could not be checked, with a way to try again', async () => {
        const { client } = setup(new TypeError('Failed to fetch'));

        expect(await screen.findByText(/couldn't check the cancellation terms/i)).toBeInTheDocument();
        client.get.mockResolvedValue(ok(FULL));
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(await screen.findByText(/refunded in full/i)).toBeInTheDocument();
    });
});

describe('leaving', () => {
    it('keeps the booking when asked to', async () => {
        const { onClose } = setup(FULL);
        fireEvent.click(await screen.findByRole('button', { name: /keep my booking/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', async () => {
        const { onClose } = setup(FULL);
        await screen.findByRole('button', { name: /keep my booking/i });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('a hotel that will not cancel', () => {
    it('says what the server says: the booking is unchanged and nothing was refunded', async () => {
        const refusal = Object.assign(new Error('refused'), {
            status: 409, code: 'CANCEL_REFUSED',
            body: { error: 'CANCEL_REFUSED', message: 'The hotel did not accept the cancellation, so your booking has not changed and you have not been refunded.' },
        });
        setup(FULL, () => { throw refusal; });

        fireEvent.click(await screen.findByRole('button', { name: /cancel and get/i }));

        expect(await screen.findByText(/did not accept the cancellation/i)).toBeInTheDocument();
        expect(screen.queryByText(/refund is on its way/i)).not.toBeInTheDocument();
    });

    it('keeps the generic message for an ordinary failure', async () => {
        setup(FULL, () => { throw Object.assign(new Error('boom'), { status: 500, body: { error: 'INTERNAL_ERROR' } }); });
        fireEvent.click(await screen.findByRole('button', { name: /cancel and get/i }));
        expect(await screen.findByText(/couldn't cancel this booking/i)).toBeInTheDocument();
    });
});
