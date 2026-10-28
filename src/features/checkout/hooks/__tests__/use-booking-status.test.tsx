import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBookingStatus } from '../use-booking-status';
import type { CheckoutHttp } from '../../lib/hotel-checkout-api';

const status = (s: string | null, extra: Record<string, unknown> = {}) => ({
    success: true, data: { reference: 'CG-ABC123', status: s, bookingStatus: null, failure: null, ...extra },
});

function client(...answers: Array<unknown | Error>) {
    let i = 0;
    const get = vi.fn(async () => {
        const a = answers[Math.min(i, answers.length - 1)];
        i += 1;
        if (a instanceof Error) throw a;
        return a;
    });
    return { get, post: vi.fn() } as unknown as CheckoutHttp & { get: ReturnType<typeof vi.fn> };
}

const opts = { pollMs: 10, maxPolls: 4 };

describe('useBookingStatus', () => {
    it('loads the booking once and stops when it is settled', async () => {
        const c = client(status('CONFIRMED', { bookingStatus: 'confirmed' }));
        const { result } = renderHook(() => useBookingStatus('CG-ABC123', { ...opts, client: c }));

        expect(result.current.load).toBe('loading');
        await waitFor(() => expect(result.current.load).toBe('ready'));

        expect(result.current.outcome).toMatchObject({ kind: 'confirmed', reference: 'CG-ABC123' });
        await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
        expect(c.get).toHaveBeenCalledTimes(1);
    });

    it('keeps asking while the booking is being made, and updates by itself', async () => {
        // The second answer is held until the test has seen the first, so the intermediate
        // state is observed rather than raced past.
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        let calls = 0;
        const c = {
            get: vi.fn(async () => {
                calls += 1;
                if (calls === 1) return status('SUPPLIER_BOOKING');
                await gate;
                return status('CONFIRMED', { bookingStatus: 'confirmed' });
            }),
            post: vi.fn(),
        } as unknown as CheckoutHttp;

        const { result } = renderHook(() => useBookingStatus('CG-ABC123', { ...opts, client: c }));

        await waitFor(() => expect(result.current.outcome?.kind).toBe('pending'));
        expect(result.current.load).toBe('ready');

        await act(async () => { release(); });
        await waitFor(() => expect(result.current.outcome?.kind).toBe('confirmed'));
    });

    it('gives up after its budget, and says the answer is still not settled', async () => {
        const c = client(status('SUPPLIER_BOOKING'));
        const { result } = renderHook(() => useBookingStatus('CG-ABC123', { ...opts, client: c }));

        await waitFor(() => expect(c.get).toHaveBeenCalledTimes(4));
        await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

        expect(c.get).toHaveBeenCalledTimes(4);
        expect(result.current.load).toBe('ready');
        expect(result.current.outcome?.kind).toBe('pending');
        expect(result.current.exhausted).toBe(true);
    });

    it('says a booking is not found when the server says so — and does not keep asking', async () => {
        const c = client(Object.assign(new Error('Booking not found'), { status: 404, code: 'BOOKING_NOT_FOUND' }));
        const { result } = renderHook(() => useBookingStatus('CG-NOPE00', { ...opts, client: c }));

        await waitFor(() => expect(result.current.load).toBe('not_found'));
        expect(c.get).toHaveBeenCalledTimes(1);
    });

    it('reports a failure to load as an error the reader can retry', async () => {
        const c = client(new TypeError('Failed to fetch'), status('CONFIRMED'));
        const { result } = renderHook(() => useBookingStatus('CG-ABC123', { ...opts, client: c }));

        await waitFor(() => expect(result.current.load).toBe('error'));
        await act(async () => { await result.current.refresh(); });

        await waitFor(() => expect(result.current.load).toBe('ready'));
    });

    it('asks again on demand, with a fresh budget', async () => {
        const c = client(status('SUPPLIER_BOOKING'));
        const { result } = renderHook(() => useBookingStatus('CG-ABC123', { ...opts, client: c }));
        await waitFor(() => expect(result.current.exhausted).toBe(true));

        await act(async () => { await result.current.refresh(); });

        await waitFor(() => expect(c.get.mock.calls.length).toBeGreaterThan(4));
    });

    it('does nothing without a reference', async () => {
        const c = client(status('CONFIRMED'));
        const { result } = renderHook(() => useBookingStatus('', { ...opts, client: c }));
        await act(async () => { await Promise.resolve(); });
        expect(result.current.load).toBe('not_found');
        expect(c.get).not.toHaveBeenCalled();
    });
});
