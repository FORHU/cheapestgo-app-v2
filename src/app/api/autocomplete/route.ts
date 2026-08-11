import { NextRequest } from 'next/server';
import type { Destination } from '@/shared/types';

// ─── Flights mode: airport search via BE (Duffel Places API) ─────────────────

async function fetchAirportsFromBackend(query: string): Promise<Destination[]> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return [];

    try {
        const res = await fetch(
            `${apiBase}/airports/search?q=${encodeURIComponent(query)}&limit=8`,
            { signal: AbortSignal.timeout(4000) },
        );
        if (!res.ok) return [];

        const json = await res.json() as {
            success: boolean;
            data: { iata: string; name: string; city: string; country: string }[];
        };
        if (!json.success) return [];

        return json.data.map(airport => ({
            type: 'airport' as const,
            title: `${airport.city} (${airport.iata})`,
            subtitle: `${airport.name} · ${airport.country}`,
            code: airport.iata,
            countryCode: '',
        }));
    } catch {
        return [];
    }
}

// ─── Hotels mode: suggestions via BE (Mapbox + hotel-coverage filter + alias resolution) ──

interface BeSuggestResponse {
    destinations: Array<{
        type:        'city' | 'country';
        rung:        string;
        title:       string;
        subtitle:    string;
        countryCode: string;
        id?:         string;
        lat?:        number;
        lng?:        number;
        code?:       string;
    }>;
    hotels: Array<{
        id:           string;
        name:         string | null;
        city:         string | null;
        country:      string | null;
        starRating?:  number | null;
        reviewRating?: number | null;
        image:        string | null;
        lat?:         number | null;
        lng?:         number | null;
    }>;
}

async function fetchHotelSuggestFromBackend(query: string): Promise<Destination[]> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return [];

    try {
        const res = await fetch(
            `${apiBase}/hotels/suggest?q=${encodeURIComponent(query)}`,
            { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return [];

        const json = await res.json() as BeSuggestResponse;
        const { destinations = [], hotels = [] } = json;

        const destItems: Destination[] = destinations.map(d => ({
            type:        d.type === 'country' ? 'country' as const : 'city' as const,
            title:       d.title,
            subtitle:    d.subtitle,
            countryCode: d.countryCode ?? '',
            id:          d.id,
            lat:         d.lat,
            lng:         d.lng,
            code:        d.code,
        }));

        const hotelItems: Destination[] = hotels.slice(0, 4).map(h => ({
            type:        'hotel' as const,
            title:       h.name ?? '',
            subtitle:    [h.city, h.country].filter(Boolean).join(', '),
            id:          String(h.id ?? ''),
            lat:         h.lat ?? undefined,
            lng:         h.lng ?? undefined,
            image:       h.image ?? null,
        }));

        return [...destItems, ...hotelItems];
    } catch {
        return [];
    }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('query') ?? '';
    const mode  = req.nextUrl.searchParams.get('mode') ?? 'hotels';

    if (!query || query.length < 2) {
        return Response.json({ success: true, data: [] });
    }

    try {
        if (mode === 'flights') {
            const data = await fetchAirportsFromBackend(query);
            return Response.json({ success: true, data });
        }

        // Hotels mode: delegate entirely to the BE
        const data = await fetchHotelSuggestFromBackend(query);
        return Response.json({ success: true, data });
    } catch {
        return Response.json({ success: false, error: 'Autocomplete failed' }, { status: 500 });
    }
}
