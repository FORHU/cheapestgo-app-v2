/**
 * URL builders for the landing page's search entry points.
 *
 * Kept in one place so every card, tab and CTA lands on the same routes with
 * the same param names the search pages actually read:
 *   - /flights/search  → src/app/flights/search/page.tsx
 *   - /search          → src/app/search/page.tsx  (hotels + map)
 *   - /property/[id]   → src/app/property/[id]/page.tsx
 */

import { NIGHTS } from '@/features/landing/data/catalog';

/**
 * A date as the URL and the supplier both write it, in the traveller's own calendar.
 *
 * Not `toISOString()`. Every caller here builds a Date from the local calendar, and
 * `toISOString` restates it in UTC — so east of Greenwich local midnight belongs to the
 * previous day and every deep link on the landing page left a day early. In Manila on
 * 29 September the cards linked to the 28th.
 */
export function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
}

export interface TripDates {
    depart: string;
    ret: string;
}

/**
 * Dates a card deep-links with when the user hasn't picked any: a month out,
 * staying `NIGHTS` nights.
 *
 * Compute this once on the server and pass it down — calling it again during
 * hydration would disagree with cached HTML rendered on the previous day.
 */
export function defaultTripDates(nights = NIGHTS): TripDates {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const depart = addDays(today, 30);
    return { depart: isoDate(depart), ret: isoDate(addDays(depart, nights)) };
}

/**
 * The departure date a flight search should actually ask for.
 *
 * A route can be named without a date — `/flights/MNL-ICN` is a page about a route, and
 * a link shared last month names a day that has gone. Neither is a reason to refuse to
 * search: the airline simply rejects a departure in the past, and the page then reads as
 * though the route has no flights.
 *
 * A month out, which is where the fares this product exists to find actually are. That is
 * deliberately not the hotels' rule — a **Default Stay** is next Friday to Sunday because
 * of what OTV has inventory for, and it has nothing to say about airfare.
 */
export function resolveDepartureDate(date?: string | null): { departure: string; chosen: boolean } {
    const asked = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    const today = isoDate(new Date());
    if (asked && asked > today) return { departure: asked, chosen: true };
    return { departure: defaultTripDates().depart, chosen: false };
}

export interface FlightSearchQuery {
    origin: string;
    destination: string;
    depart: string;
    ret?: string;
    tripType?: 'one-way' | 'round-trip' | 'multi-city';
    cabin?: string;
    adults?: number;
    children?: number;
    infants?: number;
}

export function flightSearchUrl(q: FlightSearchQuery): string {
    const params = new URLSearchParams({
        origin: q.origin,
        destination: q.destination,
        depart: q.depart,
        tripType: q.tripType ?? (q.ret ? 'round-trip' : 'one-way'),
        cabin: q.cabin ?? 'economy',
        adults: String(q.adults ?? 1),
        children: String(q.children ?? 0),
        infants: String(q.infants ?? 0),
    });
    if (q.ret) params.set('return', q.ret);
    return `/flights/search?${params.toString()}`;
}

export interface HotelSearchQuery {
    destination: string;
    checkIn: string;
    checkOut: string;
    adults?: number;
    children?: number;
    rooms?: number;
    lat?: number;
    lng?: number;
    countryCode?: string;
    code?: string;
    type?: string;
}

export function hotelSearchUrl(q: HotelSearchQuery): string {
    const params = new URLSearchParams({
        destination: q.destination,
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        adults: String(q.adults ?? 2),
        children: String(q.children ?? 0),
        rooms: String(q.rooms ?? 1),
    });
    if (q.lat != null && q.lng != null) {
        params.set('lat', String(q.lat));
        params.set('lng', String(q.lng));
    }
    if (q.countryCode) params.set('countryCode', q.countryCode);
    if (q.code) params.set('code', q.code);
    if (q.type) params.set('type', q.type);
    return `/search?${params.toString()}`;
}

export function propertyUrl(id: string, q: HotelSearchQuery): string {
    return `/property/${id}?${hotelSearchUrl(q).split('?')[1]}`;
}
