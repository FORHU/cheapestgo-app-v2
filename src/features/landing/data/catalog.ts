/**
 * Curated landing catalog.
 *
 * These rows are the *fallback* for the landing card sections: the page always
 * tries the live API first (`/flights/deals`, `/hotels/deals`) and only falls
 * back here when the API is unreachable or returns nothing. They also back the
 * "Where can I go?" budget explorer, which needs a stable priced set to filter
 * against rather than whatever happens to be in the deals table.
 *
 * Prices are PHP — flight is round trip all-in, hotel is per night all-in.
 */

export const NIGHTS = 5;
export const HOME_AIRPORT = 'MNL';
export const CATALOG_CURRENCY = 'PHP';

export interface TripSeed {
    city: string;
    country: string;
    /** Destination IATA code. */
    code: string;
    /** Slug into /images/destinations/{slug}.jpg */
    slug: string;
    /** Round-trip flight, PHP, taxes included. */
    flight: number;
    /** Hotel per night, PHP, taxes included. */
    hotel: number;
    stops: number;
    /** Flight duration in hours, used by the "under 6h" filter. */
    hours: number;
    duration: string;
    airline: string;
    kind: 'beach' | 'city';
    refundable: boolean;
}

export const TRIPS: TripSeed[] = [
    { city: 'Boracay',   country: 'Philippines', code: 'MPH', slug: 'boracay',   flight: 3100,  hotel: 3600, stops: 0, hours: 1.2,  duration: '1h 10m',  airline: 'Cebu Pacific',        kind: 'beach', refundable: true },
    { city: 'Singapore', country: 'Singapore',   code: 'SIN', slug: 'singapore', flight: 6400,  hotel: 3400, stops: 0, hours: 3.7,  duration: '3h 40m',  airline: 'Scoot',               kind: 'city',  refundable: true },
    { city: 'Hong Kong', country: 'China',       code: 'HKG', slug: 'hong-kong', flight: 7200,  hotel: 4600, stops: 0, hours: 2.1,  duration: '2h 05m',  airline: 'Cathay Pacific',      kind: 'city',  refundable: false },
    { city: 'Bali',      country: 'Indonesia',   code: 'DPS', slug: 'bali',      flight: 9850,  hotel: 2900, stops: 0, hours: 4.3,  duration: '4h 15m',  airline: 'Philippine Airlines', kind: 'beach', refundable: true },
    { city: 'Seoul',     country: 'South Korea', code: 'ICN', slug: 'seoul',     flight: 11700, hotel: 3900, stops: 0, hours: 4.1,  duration: '4h 05m',  airline: 'Jeju Air',            kind: 'city',  refundable: true },
    { city: 'Tokyo',     country: 'Japan',       code: 'NRT', slug: 'tokyo',     flight: 14980, hotel: 5100, stops: 0, hours: 4.4,  duration: '4h 25m',  airline: 'Philippine Airlines', kind: 'city',  refundable: true },
    { city: 'Dubai',     country: 'UAE',         code: 'DXB', slug: 'dubai',     flight: 21400, hotel: 6240, stops: 0, hours: 9.7,  duration: '9h 40m',  airline: 'Emirates',            kind: 'city',  refundable: false },
    { city: 'Paris',     country: 'France',      code: 'CDG', slug: 'paris',     flight: 34200, hotel: 8100, stops: 1, hours: 15.8, duration: '15h 50m', airline: 'Qatar Airways',       kind: 'city',  refundable: true },
    { city: 'Santorini', country: 'Greece',      code: 'JTR', slug: 'santorini', flight: 38400, hotel: 7800, stops: 1, hours: 16.5, duration: '16h 30m', airline: 'Emirates',            kind: 'beach', refundable: true },
    { city: 'New York',  country: 'USA',         code: 'JFK', slug: 'new-york',  flight: 41800, hotel: 9400, stops: 1, hours: 19.3, duration: '19h 20m', airline: 'ANA',                 kind: 'city',  refundable: false },
];

export interface StaySeed {
    name: string;
    city: string;
    area: string;
    /** Per night, PHP, taxes and resort fees included. */
    price: number;
    rating: string;
    slug: string;
}

export const STAYS: StaySeed[] = [
    { name: 'Marina View Suites',    city: 'Dubai',     area: 'Marina',     price: 6240, rating: '4.7', slug: 'dubai' },
    { name: 'Shinjuku Garden Hotel', city: 'Tokyo',     area: 'Shinjuku',   price: 5100, rating: '4.8', slug: 'tokyo' },
    { name: 'Seminyak Beach Villas', city: 'Bali',      area: 'Seminyak',   price: 2900, rating: '4.9', slug: 'bali' },
    { name: 'Orchard Central Rooms', city: 'Singapore', area: 'Orchard',    price: 3400, rating: '4.6', slug: 'singapore' },
    { name: 'Station Cliff Hotel',   city: 'Boracay',   area: 'Station 1',  price: 3600, rating: '4.5', slug: 'boracay' },
    { name: 'Myeongdong Stay',       city: 'Seoul',     area: 'Myeongdong', price: 3900, rating: '4.7', slug: 'seoul' },
    { name: 'Caldera Terrace Suites', city: 'Santorini', area: 'Oia',       price: 7800, rating: '4.9', slug: 'santorini' },
    { name: 'Rive Gauche Hôtel',     city: 'Paris',     area: '6e',         price: 8100, rating: '4.6', slug: 'paris' },
    { name: 'Harbour Point Rooms',   city: 'Hong Kong', area: 'Kowloon',    price: 4600, rating: '4.4', slug: 'hong-kong' },
];

/** Chips in the "Where can I go?" panel. Each narrows the catalog. */
export interface BudgetFilter {
    id: string;
    label: string;
    test: (t: TripSeed) => boolean;
}

export const BUDGET_FILTERS: BudgetFilter[] = [
    { id: 'nonstop',    label: 'Nonstop only',      test: (t) => t.stops === 0 },
    { id: 'short',      label: 'Under 6h flight',   test: (t) => t.hours < 6 },
    { id: 'beach',      label: 'Beach',             test: (t) => t.kind === 'beach' },
    { id: 'refundable', label: 'Free cancellation', test: (t) => t.refundable },
];

export const BUDGET_MIN = 15000;
export const BUDGET_MAX = 100000;
export const BUDGET_STEP = 1000;
export const BUDGET_DEFAULT = 45000;

/** Total trip cost for one person: round-trip flight + NIGHTS of hotel. */
export function tripTotal(t: TripSeed): number {
    return t.flight + t.hotel * NIGHTS;
}

export function destinationImage(slug: string): string {
    return `/images/destinations/${slug}.jpg`;
}
