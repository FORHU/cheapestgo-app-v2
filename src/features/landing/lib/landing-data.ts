/**
 * Server-side data for the landing card sections.
 *
 * Each row prefers live API data and degrades to the curated catalog when the
 * API is unreachable or the deals table is empty, so the landing page never
 * renders an empty rail. `sourcedFrom` records which one won, so the UI can be
 * honest about it.
 */

import { cache } from 'react';
import {
    TRIPS, STAYS, NIGHTS, HOME_AIRPORT, CATALOG_CURRENCY,
    tripTotal, destinationImage,
    type TripSeed,
} from '@/features/landing/data/catalog';

// ─── View models consumed by the card components ──────────────────────────────

export interface FlightDealItem {
    id: string;
    city: string;
    country?: string;
    origin: string;
    code: string;
    image: string;
    /** Round-trip total, in `currency`. */
    price: number;
    currency: string;
    /** "Nonstop" / "1 stop" */
    tag: string;
    /** "Cebu Pacific · 4h 25m" */
    detail: string;
    departDate?: string;
    returnDate?: string;
    cabinClass?: string;
}

export interface StayItem {
    id: string;
    name: string;
    city: string;
    location: string;
    image: string;
    /** Per night, in `currency`. */
    price: number;
    currency: string;
    rating: string;
    /** Present only for live deals — lets the card deep-link to the property page. */
    propertyId?: string;
    checkIn?: string;
    checkOut?: string;
}

export interface BundleItem {
    id: string;
    city: string;
    code: string;
    image: string;
    /** Flight + `nights` of hotel, per person. */
    total: number;
    flight: number;
    hotelPerNight: number;
    currency: string;
    nights: number;
    stops: number;
    origin: string;
    /** Chip ids from BUDGET_FILTERS this bundle satisfies. */
    tags: string[];
}

export interface LandingData {
    flightDeals: FlightDealItem[];
    stays: StayItem[];
    bundles: BundleItem[];
    sourcedFrom: { flights: 'api' | 'catalog'; stays: 'api' | 'catalog' };
}

// ─── Raw API shapes (columns of flight_deals / hotel_deals) ───────────────────

interface ApiFlightDeal {
    id?: string;
    origin?: string;
    destination?: string;
    price?: number | string;
    currency?: string | null;
    airline?: string | null;
    image_url?: string | null;
    departure_date?: string | null;
    return_date?: string | null;
    discount_tag?: string | null;
    cabin_class?: string | null;
}

interface ApiHotelDeal {
    id?: string;
    name?: string;
    location?: string;
    destination?: string;
    rating?: number | string | null;
    image_url?: string | null;
    price?: number | string;
    currency?: string | null;
    hotel_code?: string | null;
    check_in?: string | null;
    check_out?: string | null;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

const REVALIDATE_SECONDS = 300;

async function apiGet<T>(path: string): Promise<T | null> {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    try {
        const res = await fetch(`${base}${path}`, {
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

const CITY_BY_IATA: Record<string, { city: string; slug: string }> = Object.fromEntries(
    TRIPS.map((t) => [t.code, { city: t.city, slug: t.slug }])
);

/** Airports the catalog doesn't cover but the deals cron syncs. */
const EXTRA_IATA: Record<string, { city: string; slug: string }> = {
    KUL: { city: 'Kuala Lumpur', slug: 'kuala-lumpur' },
    BKK: { city: 'Bangkok',      slug: 'bangkok' },
    SYD: { city: 'Sydney',       slug: 'sydney' },
    LHR: { city: 'London',       slug: 'london' },
    CEB: { city: 'Cebu',         slug: 'cebu' },
    MNL: { city: 'Manila',       slug: 'manila' },
    NRT: { city: 'Tokyo',        slug: 'tokyo' },
    ICN: { city: 'Seoul',        slug: 'seoul' },
};

function resolveIata(code: string): { city: string; slug: string } {
    const upper = code.toUpperCase();
    return CITY_BY_IATA[upper] ?? EXTRA_IATA[upper] ?? { city: upper, slug: 'manila' };
}

function toNumber(v: number | string | null | undefined): number {
    const n = typeof v === 'string' ? Number(v) : v;
    return Number.isFinite(n) && n != null ? (n as number) : 0;
}

function isUsableImage(url: string | null | undefined): url is string {
    if (!url || url.trim() === '') return false;
    const u = url.toLowerCase();
    return !(u.includes('placeholder') || u.includes('picsum') || u.endsWith('.svg'));
}

function dateOnly(v: string | null | undefined): string | undefined {
    return v ? v.slice(0, 10) : undefined;
}

// ─── Catalog projections (used as fallback and by the budget explorer) ────────

function catalogFlightDeals(): FlightDealItem[] {
    return TRIPS.map((t) => ({
        id: `catalog-flight-${t.code}`,
        city: t.city,
        country: t.country,
        origin: HOME_AIRPORT,
        code: t.code,
        image: destinationImage(t.slug),
        price: t.flight,
        currency: CATALOG_CURRENCY,
        tag: t.stops === 0 ? 'Nonstop' : `${t.stops} stop`,
        detail: `${t.airline} · ${t.duration}`,
    }));
}

function catalogStays(): StayItem[] {
    return STAYS.map((s) => ({
        id: `catalog-stay-${s.slug}-${s.name}`,
        name: s.name,
        city: s.city,
        location: `${s.city} · ${s.area}`,
        image: destinationImage(s.slug),
        price: s.price,
        currency: CATALOG_CURRENCY,
        rating: s.rating,
    }));
}

function bundleTags(t: TripSeed): string[] {
    const tags: string[] = [];
    if (t.stops === 0) tags.push('nonstop');
    if (t.hours < 6) tags.push('short');
    if (t.kind === 'beach') tags.push('beach');
    if (t.refundable) tags.push('refundable');
    return tags;
}

/** Every catalog trip priced as a flight + `NIGHTS` hotel bundle, cheapest first. */
export function catalogBundles(): BundleItem[] {
    return TRIPS
        .map((t) => ({
            id: `bundle-${t.code}`,
            city: t.city,
            code: t.code,
            image: destinationImage(t.slug),
            total: tripTotal(t),
            flight: t.flight,
            hotelPerNight: t.hotel,
            currency: CATALOG_CURRENCY,
            nights: NIGHTS,
            stops: t.stops,
            origin: HOME_AIRPORT,
            tags: bundleTags(t),
        }))
        .sort((a, b) => a.total - b.total);
}

// ─── Public loaders ───────────────────────────────────────────────────────────

export const getFlightDeals = cache(async (): Promise<{ items: FlightDealItem[]; source: 'api' | 'catalog' }> => {
    const json = await apiGet<{ deals?: ApiFlightDeal[] } | ApiFlightDeal[]>('/flights/deals?limit=12');
    const raw = Array.isArray(json) ? json : json?.deals ?? [];

    const items: FlightDealItem[] = raw
        .filter((d) => d.origin && d.destination && toNumber(d.price) > 0)
        .map((d) => {
            const { city, slug } = resolveIata(d.destination!);
            return {
                id: d.id ?? `${d.origin}-${d.destination}`,
                city,
                origin: d.origin!.toUpperCase(),
                code: d.destination!.toUpperCase(),
                image: isUsableImage(d.image_url) ? d.image_url : destinationImage(slug),
                price: toNumber(d.price),
                currency: d.currency ?? 'USD',
                tag: d.discount_tag?.trim() || (d.return_date ? 'Round trip' : 'One way'),
                detail: [d.airline, `${d.origin!.toUpperCase()} → ${d.destination!.toUpperCase()}`]
                    .filter(Boolean)
                    .join(' · '),
                departDate: dateOnly(d.departure_date),
                returnDate: dateOnly(d.return_date),
                cabinClass: d.cabin_class ?? 'economy',
            };
        });

    return items.length > 0
        ? { items, source: 'api' }
        : { items: catalogFlightDeals(), source: 'catalog' };
});

export const getStayDeals = cache(async (): Promise<{ items: StayItem[]; source: 'api' | 'catalog' }> => {
    const json = await apiGet<{ deals?: ApiHotelDeal[] } | ApiHotelDeal[]>('/hotels/deals?limit=12');
    const raw = Array.isArray(json) ? json : json?.deals ?? [];

    const items: StayItem[] = raw
        .filter((d) => d.name && toNumber(d.price) > 0)
        .map((d, i) => {
            const city = d.destination ?? d.location ?? '';
            const slugGuess = city.toLowerCase().replace(/[^a-z]+/g, '-');
            return {
                id: d.id ?? `stay-${i}`,
                name: d.name!,
                city,
                location: [city, d.location].filter(Boolean).join(' · '),
                image: isUsableImage(d.image_url) ? d.image_url : destinationImage(slugGuess),
                price: toNumber(d.price),
                currency: d.currency ?? CATALOG_CURRENCY,
                rating: toNumber(d.rating) > 0 ? toNumber(d.rating).toFixed(1) : '—',
                propertyId: d.hotel_code || undefined,
                checkIn: dateOnly(d.check_in),
                checkOut: dateOnly(d.check_out),
            };
        });

    return items.length > 0
        ? { items, source: 'api' }
        : { items: catalogStays(), source: 'catalog' };
});

export const getLandingData = cache(async (): Promise<LandingData> => {
    const [flights, stays] = await Promise.all([getFlightDeals(), getStayDeals()]);
    return {
        flightDeals: flights.items,
        stays: stays.items,
        bundles: catalogBundles(),
        sourcedFrom: { flights: flights.source, stays: stays.source },
    };
});
