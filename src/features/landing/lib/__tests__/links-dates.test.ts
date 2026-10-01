/**
 * The dates the landing page and the flight search agree on.
 *
 * Two bugs met here. `isoDate` restated a locally-built Date in UTC, so east of Greenwich
 * every deep link on the landing page left a day early — in Manila on 29 September the
 * cards linked to the 28th. And a flight search with no date at all answered "Missing
 * search parameters", which is what every `/flights/XXX-YYY` route redirected into.
 */
import { describe, it, expect } from 'vitest';
import { isoDate, defaultTripDates, resolveDepartureDate } from '../links';

/** The local calendar day `offset` days out, the way the URL writes it. */
const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('isoDate', () => {
    it('keeps the day the traveller is actually on', () => {
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        expect(isoDate(midnight)).toBe(day(0));
    });

    it('does not drift across a date boundary in either direction', () => {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        expect(isoDate(endOfDay)).toBe(day(0));
    });
});

describe('defaultTripDates', () => {
    it('departs a month out, where the cheap fares are', () => {
        expect(defaultTripDates().depart).toBe(day(30));
    });

    it('returns after it departs', () => {
        const { depart, ret } = defaultTripDates();
        expect(ret > depart).toBe(true);
    });
});

describe('resolveDepartureDate', () => {
    it('keeps a date the traveller named', () => {
        expect(resolveDepartureDate(day(10))).toEqual({ departure: day(10), chosen: true });
    });

    const NO_DATE: Array<[string | null | undefined, string]> = [
        [null, 'a route page, which names no date'],
        [undefined, 'a link built without one'],
        ['', 'an empty param'],
        ['not-a-date', 'something that is not a date'],
    ];

    it.each(NO_DATE)('falls back when given %s (%s)', (input) => {
        const resolved = resolveDepartureDate(input);
        expect(resolved.departure).toBe(defaultTripDates().depart);
        expect(resolved.chosen).toBe(false);
    });

    it.each([[-30], [-1], [0]])('falls back rather than ask an airline for day %i', (offset) => {
        // Today included: a same-day search is past its cutoff for most of the day, and
        // the airline rejects the ones that are — which reads as a route with no flights.
        expect(resolveDepartureDate(day(offset)).departure).toBe(defaultTripDates().depart);
    });
});
