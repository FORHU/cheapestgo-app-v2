import { describe, it, expect, vi } from 'vitest';
import {
    cancelHotelBooking,
    confirmCancellation,
    fetchCancelPreview,
    previewChanged,
    type CancelHttp,
    type CancelPreview,
} from '../hotel-cancel';

const PREVIEW: CancelPreview = {
    reference: 'CG-ABC123', cancellable: true, status: 'confirmed',
    paid:    { amount: 264, currency: 'USD' },
    refund:  { amount: 132, currency: 'USD', type: 'partial_refund', ratio: 0.5 },
    penalty: { amount: 132, currency: 'USD' },
    deadline: '2026-11-05T10:00:00.000Z',
    policy: 'standard',
    message: 'Cancelling now incurs a penalty of 132 USD; 132 USD is refunded.',
};

function client(over: Partial<CancelHttp> = {}) {
    return { get: vi.fn(), post: vi.fn(), ...over } as unknown as CancelHttp & {
        get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>;
    };
}

describe('fetchCancelPreview', () => {
    it('asks about the booking by reference, encoded', async () => {
        const c = client();
        c.get.mockResolvedValue({ success: true, data: PREVIEW });

        expect(await fetchCancelPreview(c, 'CG-ABC123')).toEqual(PREVIEW);
        expect(c.get).toHaveBeenCalledWith('/hotels/bookings/CG-ABC123/cancel-preview');

        await fetchCancelPreview(c, 'a/b');
        expect(c.get).toHaveBeenLastCalledWith('/hotels/bookings/a%2Fb/cancel-preview');
    });

    it('refuses a response without a preview in it', async () => {
        const c = client();
        c.get.mockResolvedValue({ success: true });
        await expect(fetchCancelPreview(c, 'CG-ABC123')).rejects.toThrow(/not understood/i);
    });
});

describe('previewChanged', () => {
    it('is false for the same terms', () => {
        expect(previewChanged(PREVIEW, { ...PREVIEW })).toBe(false);
    });

    it('is true when the refund moved — a penalty tier began in between', () => {
        expect(previewChanged(PREVIEW, { ...PREVIEW, refund: { ...PREVIEW.refund, amount: 0, type: 'no_refund' } })).toBe(true);
    });

    it('is true when the refund type changed even if the amount did not', () => {
        expect(previewChanged(PREVIEW, { ...PREVIEW, refund: { ...PREVIEW.refund, type: 'full_refund' } })).toBe(true);
    });

    it('is false when only the wording or the deadline moved', () => {
        expect(previewChanged(PREVIEW, { ...PREVIEW, message: 'different', deadline: null })).toBe(false);
    });
});

describe('cancelHotelBooking', () => {
    it('cancels by reference and reports what became of the money', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { bookingId: 'CG-ABC123', status: 'cancelled_refunded', message: 'Booking cancelled and refund processed.' } });

        expect(await cancelHotelBooking(c, 'CG-ABC123')).toEqual({
            status: 'cancelled_refunded', refunded: true, refundFailed: false, message: 'Booking cancelled and refund processed.',
        });
        expect(c.post).toHaveBeenCalledWith('/hotels/cancel', { bookingRef: 'CG-ABC123' });
    });

    it('says plainly when cancelled but the refund did not go through', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { bookingId: 'x', status: 'cancelled_refund_failed', message: 'Refund failed: boom' } });

        expect(await cancelHotelBooking(c, 'x')).toMatchObject({ refunded: false, refundFailed: true });
    });

    it('does not call a plain cancellation a refund', async () => {
        const c = client();
        c.post.mockResolvedValue({ success: true, data: { bookingId: 'x', status: 'cancelled', message: 'Non-refundable.' } });

        expect(await cancelHotelBooking(c, 'x')).toMatchObject({ refunded: false, refundFailed: false });
    });
});

describe('confirmCancellation', () => {
    it('cancels when the figure is still what the traveller saw', async () => {
        const c = client();
        c.get.mockResolvedValue({ success: true, data: PREVIEW });
        c.post.mockResolvedValue({ success: true, data: { bookingId: 'CG-ABC123', status: 'cancelled_refunded', message: 'ok' } });

        const out = await confirmCancellation(c, 'CG-ABC123', PREVIEW);

        expect(out.kind).toBe('cancelled');
        expect(c.post).toHaveBeenCalledTimes(1);
    });

    it('does NOT cancel when the figure moved, and hands back the new one', async () => {
        const c = client();
        const worse = { ...PREVIEW, refund: { ...PREVIEW.refund, amount: 0, type: 'no_refund' as const }, penalty: { amount: 264, currency: 'USD' } };
        c.get.mockResolvedValue({ success: true, data: worse });

        const out = await confirmCancellation(c, 'CG-ABC123', PREVIEW);

        expect(out).toEqual({ kind: 'changed', preview: worse });
        expect(c.post).not.toHaveBeenCalled();
    });

    it('does not cancel a booking that can no longer be cancelled', async () => {
        const c = client();
        c.get.mockResolvedValue({ success: true, data: { ...PREVIEW, cancellable: false, reason: 'already_cancelled' } });

        const out = await confirmCancellation(c, 'CG-ABC123', PREVIEW);

        expect(out).toMatchObject({ kind: 'changed' });
        expect(c.post).not.toHaveBeenCalled();
    });

    it('does not cancel on a figure it could not re-check', async () => {
        const c = client();
        c.get.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(confirmCancellation(c, 'CG-ABC123', PREVIEW)).rejects.toThrow();
        expect(c.post).not.toHaveBeenCalled();
    });
});
