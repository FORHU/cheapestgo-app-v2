import { NextRequest } from 'next/server';
import type { Destination } from '@/shared/types';

// ─── Flights mode: airport search via BE ─────────────────────────────────────

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

// ─── Hotels mode: Mapbox + city-alias + hotel-coverage filter ─────────────────
// Uses autocompleteDestinations() directly (same as v1) so bbox and rung are
// always present — the search page needs them to scope map pins to the city.

async function fetchHotelSuggestions(query: string, locale?: string): Promise<Destination[]> {
    const { autocompleteDestinations } = await import('@/server/search');
    const result = await autocompleteDestinations(query, locale);
    if (!result.success) return [];

    return result.data.map(r => ({
        type:         r.type,
        title:        r.title,
        subtitle:     r.subtitle,
        countryCode:  r.countryCode,
        id:           r.id,
        code:         r.code,
        lat:          r.lat,
        lng:          r.lng,
        rung:         r.rung,
        bbox:         r.bbox,
        districtName: r.districtName,
        canonicalCity: r.canonicalCity,
    }));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const query  = req.nextUrl.searchParams.get('query') ?? '';
    const mode   = req.nextUrl.searchParams.get('mode') ?? 'hotels';
    const locale = req.nextUrl.searchParams.get('locale') ?? undefined;

    if (!query || query.length < 2) {
        return Response.json({ success: true, data: [] });
    }

    try {
        if (mode === 'flights') {
            const data = await fetchAirportsFromBackend(query);
            return Response.json({ success: true, data });
        }

        const data = await fetchHotelSuggestions(query, locale);
        return Response.json({ success: true, data });
    } catch {
        return Response.json({ success: false, error: 'Autocomplete failed' }, { status: 500 });
    }
}
