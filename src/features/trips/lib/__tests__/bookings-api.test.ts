import { describe, it, expect, vi } from 'vitest';
import { fetchBooking, fetchBookings, findBooking, unwrapBookings, type BookingsHttp } from '../bookings-api';
import type { AnyBooking } from '@/shared/types';

const hotel = (over: Record<string, unknown> = {}) =>
    ({ id: 'row-1', booking_id: 'CG-ABC123', type: 'hotel', property_name: 'Bayside Grand', ...over }) as unknown as AnyBooking;
const flight = (over: Record<string, unknown> = {}) =>
    ({ id: 'row-2', booking_reference: 'GG-ZZZ999', type: 'flight', ...over }) as unknown as AnyBooking;

const client = (answer: unknown) =>
    ({ get: vi.fn(async () => answer) }) as unknown as BookingsHttp & { get: ReturnType<typeof vi.fn> };

describe('unwrapBookings', () => {
    it('reads the API\'s envelope', () => {
        expect(unwrapBookings({ success: true, data: [hotel(), flight()] })).toHaveLength(2);
    });

    it('still reads a bare array, which is what an older response and the mobile app use', () => {
        expect(unwrapBookings([hotel()])).toHaveLength(1);
    });

    it('reads a named collection', () => {
        expect(unwrapBookings({ bookings: [hotel()] })).toHaveLength(1);
    });

    it('answers an empty list as empty, not as an error', () => {
        expect(unwrapBookings({ success: true, data: [] })).toEqual([]);
    });

    it('refuses a shape it does not understand rather than showing "no trips"', () => {
        expect(() => unwrapBookings({ success: true })).toThrow(/not understood/i);
        expect(() => unwrapBookings(null)).toThrow(/not understood/i);
        expect(() => unwrapBookings('nope')).toThrow(/not understood/i);
    });
});

describe('findBooking', () => {
    const list = [hotel(), flight()];

    it('finds by the row id a trip card links with', () => {
        expect(findBooking(list, 'row-1')).toBe(list[0]);
    });

    it('finds by the booking reference an email or the confirmation page links with', () => {
        expect(findBooking(list, 'CG-ABC123')).toBe(list[0]);
        expect(findBooking(list, 'GG-ZZZ999')).toBe(list[1]);
    });

    it('does not guess', () => {
        expect(findBooking(list, 'cg-abc123')).toBeUndefined();
        expect(findBooking(list, '')).toBeUndefined();
    });
});

describe('fetchBookings', () => {
    it('asks for the traveller\'s bookings', async () => {
        const c = client({ success: true, data: [hotel()] });
        expect(await fetchBookings(c)).toHaveLength(1);
        expect(c.get).toHaveBeenCalledWith('/bookings');
    });

    it('can narrow to one kind, as the API supports', async () => {
        const c = client({ success: true, data: [hotel()] });
        await fetchBookings(c, 'hotel');
        expect(c.get).toHaveBeenCalledWith('/bookings?type=hotel');
    });
});

describe('fetchBooking', () => {
    it('returns the booking by either identifier', async () => {
        const c = client({ success: true, data: [hotel(), flight()] });
        expect((await fetchBooking(c, 'row-2')).id).toBe('row-2');
        expect((await fetchBooking(c, 'GG-ZZZ999')).id).toBe('row-2');
        expect((await fetchBooking(c, 'CG-ABC123')).id).toBe('row-1');
    });

    it('fails as a 404 the screens already handle, not as an unexplained crash', async () => {
        const c = client({ success: true, data: [hotel()] });
        await expect(fetchBooking(c, 'nope')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });

    it('passes a failed request through untouched', async () => {
        const failure = Object.assign(new Error('Unauthorized'), { status: 401 });
        const c = { get: vi.fn(async () => { throw failure; }) } as unknown as BookingsHttp;
        await expect(fetchBooking(c, 'row-1')).rejects.toBe(failure);
    });
});
