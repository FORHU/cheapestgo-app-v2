import { describe, it, expect } from 'vitest';
import { formatTime, formatOfferDate, formatBookingTime } from '../flight-utils';

/**
 * Two kinds of time, and using the wrong formatter prints a departure hours out.
 *
 * An **offer's** times are Local Airport Time — the clock a boarding pass shows, quoted with
 * no UTC offset because there is nothing to convert from. A **booking's** times come out of a
 * `timestamptz` column as real instants.
 *
 * These assertions hold in any timezone on purpose: the offer formatters must give the same
 * answer on a laptop in Manila and a container in Frankfurt, which is exactly what building a
 * Date from an offset-less string fails to do.
 */

describe('formatTime — an offer, in Local Airport Time', () => {
    it('reads the clock out of the string', () => {
        expect(formatTime('2026-11-02T08:15:00')).toBe('08:15');
    });

    it('gives the same answer whether or not the string carries a zone', () => {
        // A provider that starts appending Z must not move every departure.
        expect(formatTime('2026-11-02T08:15:00Z')).toBe('08:15');
        expect(formatTime('2026-11-02T08:15:00+09:00')).toBe('08:15');
    });

    it('keeps a past-midnight departure on its own clock', () => {
        // 00:30 is where a Date-based formatter drifts to the previous evening.
        expect(formatTime('2026-11-02T00:30:00')).toBe('00:30');
    });

    it('says so rather than guessing when there is nothing to read', () => {
        expect(formatTime(undefined)).toBe('--:--');
        expect(formatTime('not a time')).toBe('--:--');
        expect(formatTime('2026-11-02T99:99:00')).toBe('--:--');
    });
});

describe('formatOfferDate — the calendar day of a Local Airport Time', () => {
    it('keeps a midnight departure on its own date', () => {
        // Formatted through the reader's zone, this reads as 1 Nov east of Greenwich.
        expect(formatOfferDate('2026-11-02T00:30:00')).toContain('Nov 2');
    });

    it('returns nothing for a date it cannot read', () => {
        expect(formatOfferDate(undefined)).toBe('');
        expect(formatOfferDate('rubbish')).toBe('');
    });
});

describe('formatBookingTime — a booking, which is a real instant', () => {
    it('formats through a Date, because the value is an instant', () => {
        const iso = '2026-11-02T08:15:00Z';
        expect(formatBookingTime(iso))
            .toBe(new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    });

    it('does not fall over on a missing or unreadable value', () => {
        expect(formatBookingTime(undefined)).toBe('--:--');
        expect(formatBookingTime('nope')).toBe('--:--');
    });
});
