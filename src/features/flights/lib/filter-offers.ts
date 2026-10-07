import type { FlightOffer, NormalizedSegment } from '@/shared/types';

/**
 * What the filter panel asks of a set of offers, and the code that answers it.
 *
 * v1's rules (`lib/flights/filter-offers` in cheapest-go-app), on v2's offer shape. Kept
 * apart from the panel and the search screen so they are testable without rendering
 * either: the predicates below are the whole of what "matching" means, and the bounds
 * are the whole of what the sliders are allowed to offer.
 */

export type FlightSortBy = 'price' | 'duration' | 'departure';

/** Minutes past midnight. 23:59 is the last minute a flight can leave on a given day. */
export const DAY_START_MINUTE = 0;
export const DAY_END_MINUTE = 24 * 60 - 1;

export interface FlightFilterState {
    sortBy: FlightSortBy;
    /** Empty means every airline — the same as every one ticked. */
    selectedAirlines: string[];
    /** null is any number of stops; 2 means two OR MORE, which is what "2 Stops +" offers. */
    stops: 0 | 1 | 2 | null;
    refundableOnly: boolean;
    selectedProviders: string[];
    /** Per-person price, inclusive, in the offers' own currency. null leaves it unbounded. */
    priceRange: [number, number] | null;
    /** Minutes past midnight, inclusive, in Local Airport Time. */
    departureWindow: [number, number] | null;
    arrivalWindow: [number, number] | null;
    maxDurationMinutes: number | null;
    selectedArrivalAirports: string[];
}

export const DEFAULT_FLIGHT_FILTERS: FlightFilterState = {
    sortBy: 'price',
    selectedAirlines: [],
    stops: null,
    refundableOnly: false,
    selectedProviders: [],
    priceRange: null,
    departureWindow: null,
    arrivalWindow: null,
    maxDurationMinutes: null,
    selectedArrivalAirports: [],
};

/** The airline a traveller would say they are flying with — the name the card shows. */
export function offerAirline(offer: FlightOffer): string {
    const first = offer.segments?.[0];
    return first?.airlineName || first?.airline || offer.provider || '';
}

/**
 * What one traveller pays. Filtered on rather than the offer total because the total
 * moves with the party size, and a price filter that shifts when a second passenger is
 * added is a filter nobody can reason about.
 */
export function offerPricePerPerson(offer: FlightOffer): number {
    return offer.price?.pricePerAdult || offer.price?.total || 0;
}

/**
 * The clock an offer's timestamp states, as minutes past midnight.
 *
 * Read out of the string rather than through a Date: an offer's times are Local Airport
 * Time with no UTC offset, so the digits ARE the clock — the same rule as `formatTime`.
 */
export function minutesOfDay(iso: string | undefined): number | null {
    if (!iso) return null;
    const m = /T(\d{2}):(\d{2})/.exec(iso);
    if (!m) return null;
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

/** Each direction's segments, in `segmentIndex` order. Missing indexes count as the outbound. */
function directions(offer: FlightOffer): NormalizedSegment[][] {
    const groups = new Map<number, NormalizedSegment[]>();
    for (const seg of offer.segments ?? []) {
        const idx = seg.segmentIndex ?? 0;
        const group = groups.get(idx);
        if (group) group.push(seg);
        else groups.set(idx, [seg]);
    }
    return [...groups.keys()].sort((a, b) => a - b).map((k) => groups.get(k)!);
}

/** The outbound's own segments — the journey the card's summary row shows. */
function outboundSegments(offer: FlightOffer): NormalizedSegment[] {
    return directions(offer)[0] ?? [];
}

/**
 * Plane changes on the direction that has the most of them.
 *
 * Never `totalStops`, which sums across a round trip: a trip that changes once each way
 * scores 2 there, while the card reads "1 stop". The worst direction rather than the
 * outbound alone is what keeps "Direct" honest — a traveller who asks for it is not
 * expecting a two-stop journey home.
 */
export function offerStopsPerDirection(offer: FlightOffer): number {
    const dirs = directions(offer);
    if (dirs.length === 0) return offer.totalStops ?? 0;
    return Math.max(...dirs.map((d) => d.length - 1));
}

export function offerDepartureMinute(offer: FlightOffer): number | null {
    return minutesOfDay(outboundSegments(offer)[0]?.departure?.time);
}

export function offerArrivalMinute(offer: FlightOffer): number | null {
    const outbound = outboundSegments(offer);
    return minutesOfDay(outbound[outbound.length - 1]?.arrival?.time);
}

export function offerArrivalAirport(offer: FlightOffer): string {
    const outbound = outboundSegments(offer);
    const last = outbound[outbound.length - 1];
    return last?.arrival?.airport || last?.destination || '';
}

/** The outbound's elapsed time, falling back to the offer-wide figure when unquoted. */
export function offerDurationMinutes(offer: FlightOffer): number {
    return offer.sliceDurations?.[0] ?? offer.totalDuration ?? 0;
}

export function offerIsRefundable(offer: FlightOffer): boolean {
    return (offer.farePolicy?.isRefundable ?? offer.refundable) === true;
}

/** Whether an offer makes a given number of plane changes, "2" meaning two or more. */
export function offerMatchesStops(offer: FlightOffer, stops: FlightFilterState['stops']): boolean {
    if (stops === null) return true;
    const actual = offerStopsPerDirection(offer);
    return stops === 2 ? actual >= 2 : actual === stops;
}

export interface FilterBounds {
    /** Per-person price across the offers. Equal ends when every offer costs the same. */
    price: [number, number];
    /** Outbound duration in minutes. */
    duration: [number, number];
    airlines: string[];
    arrivalAirports: string[];
}

/**
 * The range each slider may offer and the options each list may show, read off the
 * unfiltered results — a filter that lets a traveller ask for something no result can
 * satisfy wastes the only part of the panel that has to feel exact.
 */
export function filterBounds(offers: FlightOffer[]): FilterBounds {
    if (offers.length === 0) {
        return { price: [0, 0], duration: [0, 0], airlines: [], arrivalAirports: [] };
    }

    const prices = offers.map(offerPricePerPerson);
    const durations = offers.map(offerDurationMinutes);
    const airlines = new Set<string>();
    const arrivalAirports = new Set<string>();

    for (const offer of offers) {
        const airline = offerAirline(offer);
        if (airline) airlines.add(airline);
        const airport = offerArrivalAirport(offer);
        if (airport) arrivalAirports.add(airport);
    }

    return {
        price: [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))],
        duration: [Math.floor(Math.min(...durations)), Math.ceil(Math.max(...durations))],
        airlines: [...airlines].sort((a, b) => a.localeCompare(b)),
        arrivalAirports: [...arrivalAirports].sort((a, b) => a.localeCompare(b)),
    };
}

/** How many filters the traveller has actually narrowed by — sort is not one of them. */
export function activeFilterCount(filters: FlightFilterState): number {
    return filters.selectedAirlines.length
        + filters.selectedArrivalAirports.length
        + filters.selectedProviders.length
        + (filters.stops !== null ? 1 : 0)
        + (filters.refundableOnly ? 1 : 0)
        + (filters.priceRange ? 1 : 0)
        + (filters.departureWindow ? 1 : 0)
        + (filters.arrivalWindow ? 1 : 0)
        + (filters.maxDurationMinutes !== null ? 1 : 0);
}

function withinWindow(minute: number | null, window: [number, number] | null): boolean {
    if (!window) return true;
    // An offer whose clock cannot be read is kept: a filter should narrow by what it
    // knows, not drop a flight because its timestamp was shaped unexpectedly.
    if (minute === null) return true;
    return minute >= window[0] && minute <= window[1];
}

/** Every offer that matches, in the order the chosen sort puts them. Never sorts in place. */
export function applyFlightFilters(offers: FlightOffer[], filters: FlightFilterState): FlightOffer[] {
    const matched = offers.filter((offer) => {
        if (!offerMatchesStops(offer, filters.stops)) return false;
        if (filters.refundableOnly && !offerIsRefundable(offer)) return false;
        if (filters.selectedProviders.length > 0 && !filters.selectedProviders.includes(offer.provider)) return false;
        if (filters.selectedAirlines.length > 0 && !filters.selectedAirlines.includes(offerAirline(offer))) return false;
        if (filters.selectedArrivalAirports.length > 0
            && !filters.selectedArrivalAirports.includes(offerArrivalAirport(offer))) return false;

        if (filters.priceRange) {
            const price = offerPricePerPerson(offer);
            if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;
        }
        if (filters.maxDurationMinutes !== null && offerDurationMinutes(offer) > filters.maxDurationMinutes) {
            return false;
        }
        if (!withinWindow(offerDepartureMinute(offer), filters.departureWindow)) return false;
        if (!withinWindow(offerArrivalMinute(offer), filters.arrivalWindow)) return false;

        return true;
    });

    const sorted = [...matched];
    if (filters.sortBy === 'price') {
        sorted.sort((a, b) => (a.price?.total ?? 0) - (b.price?.total ?? 0));
    } else if (filters.sortBy === 'duration') {
        // Rank on the direction the row actually shows, not on a sum of both.
        sorted.sort((a, b) => offerDurationMinutes(a) - offerDurationMinutes(b));
    } else if (filters.sortBy === 'departure') {
        sorted.sort((a, b) => (offerDepartureMinute(a) ?? 0) - (offerDepartureMinute(b) ?? 0));
    }
    return sorted;
}
