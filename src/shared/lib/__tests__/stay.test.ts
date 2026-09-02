import { describe, expect, it } from 'vitest';
import { nightsBetween, perNight } from '@/shared/lib/stay';

/**
 * The v1 incident this guards against: a two-night stay total rendered as a nightly
 * rate, because the code that divided could not tell how long the stay was and
 * assumed one night. Both functions here refuse to make that assumption.
 */

describe('nightsBetween', () => {
    it('counts the nights of a stay', () => {
        expect(nightsBetween('2026-10-09', '2026-10-11')).toBe(2);
        expect(nightsBetween('2026-10-09', '2026-10-16')).toBe(7);
    });

    it('accepts Date objects as well as strings', () => {
        expect(nightsBetween(new Date('2026-10-09'), new Date('2026-10-11'))).toBe(2);
    });

    it('returns null when either date is missing', () => {
        // Null, not 1 — a caller that does not know the stay must not silently
        // divide a stay total by one and call the result a nightly rate.
        expect(nightsBetween(null, '2026-10-11')).toBeNull();
        expect(nightsBetween('2026-10-09', undefined)).toBeNull();
        expect(nightsBetween('', '')).toBeNull();
    });

    it('returns null for an unparseable date rather than NaN nights', () => {
        expect(nightsBetween('not-a-date', '2026-10-11')).toBeNull();
    });

    it('never returns less than one night for a readable stay', () => {
        // booking-card computed this without a floor and could return 0 or negative.
        expect(nightsBetween('2026-10-09', '2026-10-09')).toBe(1);
        expect(nightsBetween('2026-10-11', '2026-10-09')).toBe(1);
    });

    it('counts calendar nights, not 24-hour periods', () => {
        // A 15:00 arrival and an 11:00 departure two days later is two nights, though
        // only 44 hours elapse. Dividing by 24 and rounding would call that one.
        expect(nightsBetween('2026-10-09T15:00:00Z', '2026-10-11T11:00:00Z')).toBe(2);
        // And a late arrival with an early departure the next morning is still one.
        expect(nightsBetween('2026-10-09T23:00:00Z', '2026-10-10T01:00:00Z')).toBe(1);
    });

    it('agrees with the plain-date form for the dates callers actually pass', () => {
        // `bookings.check_in` is @db.Date and URL params are YYYY-MM-DD; both parse
        // to midnight UTC, so the calendar handling must not shift those results.
        expect(nightsBetween('2026-10-09', '2026-10-11')).toBe(2);
        expect(nightsBetween(new Date('2026-10-09T00:00:00Z'), new Date('2026-10-11T00:00:00Z'))).toBe(2);
    });
});

describe('perNight', () => {
    it('divides a stay total by its nights', () => {
        expect(perNight(11533, 2)).toBeCloseTo(5766.5, 4);
    });

    it('returns null when the stay length is unknown', () => {
        // The bug in one line: 11533 for two nights must never read as 11533/night.
        expect(perNight(11533, null)).toBeNull();
    });

    it('leaves a one-night total alone', () => {
        expect(perNight(5766.5, 1)).toBe(5766.5);
    });

    it('refuses a non-finite total', () => {
        expect(perNight(Number.NaN, 2)).toBeNull();
    });

    it('treats a zero or negative night count as one rather than dividing by it', () => {
        expect(perNight(500, 0)).toBe(500);
        expect(perNight(500, -3)).toBe(500);
    });
});
