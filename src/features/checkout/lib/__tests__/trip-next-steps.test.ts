import { describe, it, expect } from 'vitest';
import type { NormalizedSegment } from '@/shared/types';
import type { GolfCourse } from '@/features/golf/types';
import { arrivalStay, hotelLink, teeTimeLink } from '../trip-next-steps';

const seg = (segmentIndex: number, from: [string, string, string], to: [string, string, string]): NormalizedSegment => ({
    segmentIndex, airline: 'ZZ', origin: from[0], destination: to[0], duration: 60, stops: 0,
    departure: { airport: from[0], city: from[1], time: from[2] },
    arrival:   { airport: to[0],   city: to[1],   time: to[2] },
});

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: 'c1', slug: 'tokyo-hills', name: 'Tokyo Hills', country: 'Japan', city: 'Tokyo', address: null,
    description: '', holes: 18, par: 72, greenFeeFrom: null, currency: 'JPY', imageUrls: [], amenities: [],
    status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Tokyo', bookingWindowDays: 30, freeCancelHours: 48,
    scheduleCount: 1, bookable: true, ...over,
});

describe('arrivalStay', () => {
    it('stays where the outbound lands, from the day it lands until the return leaves', () => {
        const slices = [
            [seg(0, ['MNL', 'Manila', '2026-12-01T23:10:00'], ['NRT', 'Tokyo', '2026-12-02T04:35:00'])],
            [seg(1, ['NRT', 'Tokyo', '2026-12-08T10:00:00'], ['MNL', 'Manila', '2026-12-08T14:00:00'])],
        ];
        // Not Manila: the last slice of a round trip lands back home.
        expect(arrivalStay(slices)).toEqual({ city: 'Tokyo', checkIn: '2026-12-02', checkOut: '2026-12-08' });
    });

    it('reads the arrival off the outbound\'s last leg, not its first', () => {
        const slices = [[
            seg(0, ['MNL', 'Manila', '2026-12-01T08:00:00'], ['ICN', 'Seoul', '2026-12-01T13:00:00']),
            seg(0, ['ICN', 'Seoul', '2026-12-01T15:00:00'], ['NRT', 'Tokyo', '2026-12-01T17:30:00']),
        ]];
        expect(arrivalStay(slices)?.city).toBe('Tokyo');
    });

    it('gives a one-way the Default Stay\'s two nights, across a month end', () => {
        const slices = [[seg(0, ['MNL', 'Manila', '2026-12-31T08:00:00'], ['NRT', 'Tokyo', '2026-12-31T13:00:00'])]];
        expect(arrivalStay(slices)).toEqual({ city: 'Tokyo', checkIn: '2026-12-31', checkOut: '2027-01-02' });
    });

    it('does not end a stay before it starts when the return leaves the day it lands', () => {
        const slices = [
            [seg(0, ['MNL', 'Manila', '2026-12-01T06:00:00'], ['CEB', 'Cebu', '2026-12-01T07:00:00'])],
            [seg(1, ['CEB', 'Cebu', '2026-12-01T20:00:00'], ['MNL', 'Manila', '2026-12-01T21:00:00'])],
        ];
        expect(arrivalStay(slices)).toEqual({ city: 'Cebu', checkIn: '2026-12-01', checkOut: '2026-12-03' });
    });

    it('is null without an arrival city to search for', () => {
        expect(arrivalStay([])).toBeNull();
        const nameless = seg(0, ['MNL', 'Manila', '2026-12-01T08:00:00'], ['NRT', 'Tokyo', '2026-12-01T13:00:00']);
        expect(arrivalStay([[{ ...nameless, arrival: { airport: 'NRT', time: '2026-12-01T13:00:00' } }]])).toBeNull();
    });
});

describe('hotelLink', () => {
    it('searches the arrival city for the stay, for the adults and children who flew, in one room', () => {
        const href = hotelLink({ city: 'Tokyo', checkIn: '2026-12-02', checkOut: '2026-12-08' }, 2, 1);
        const [path, qs] = href.split('?');
        expect(path).toBe('/search');
        expect(Object.fromEntries(new URLSearchParams(qs))).toEqual({
            destination: 'Tokyo', checkIn: '2026-12-02', checkOut: '2026-12-08', adults: '2', children: '1', rooms: '1',
        });
    });
});

describe('teeTimeLink', () => {
    const stay = { city: 'Tokyo', checkIn: '2026-12-02', checkOut: '2026-12-08' };

    it('opens the one course in the arrival city on the day after landing, for the adults who flew', () => {
        expect(teeTimeLink([course()], stay, 3)).toEqual({ href: '/golf/tokyo-hills?date=2026-12-03&players=3', city: 'Tokyo' });
    });

    it('matches the city however it is cased or accented', () => {
        const link = teeTimeLink([course({ city: '  tókyo ' })], stay, 1);
        expect(link?.city).toBe('Tokyo');
    });

    it('asks for no more players than a tee time takes', () => {
        expect(teeTimeLink([course()], stay, 6)?.href).toContain('players=4');
        expect(teeTimeLink([course()], stay, 0)?.href).toContain('players=1');
    });

    it('opens on the landing day when the trip ends the next', () => {
        expect(teeTimeLink([course()], { ...stay, checkOut: '2026-12-03' }, 2)?.href).toContain('date=2026-12-02');
    });

    it('lists the country\'s courses when the arrival city has several', () => {
        const link = teeTimeLink([course(), course({ id: 'c2', slug: 'tokyo-bay' })], stay, 2);
        expect(link).toEqual({ href: '/golf?country=Japan', city: 'Tokyo' });
    });

    it('offers every course when none is in the arrival city', () => {
        expect(teeTimeLink([course({ city: 'Osaka' })], stay, 2)).toEqual({ href: '/golf', city: null });
    });

    it('offers nothing without a course that has tee times', () => {
        expect(teeTimeLink([], stay, 2)).toBeNull();
        expect(teeTimeLink([course({ bookable: false })], stay, 2)).toBeNull();
    });
});
