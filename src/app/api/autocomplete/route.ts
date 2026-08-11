import { NextRequest } from 'next/server';

const COUNTRY_SEARCH_LIST: { name: string; code: string }[] = [
    { name: 'Philippines', code: 'PH' },
    { name: 'South Korea', code: 'KR' },
    { name: 'Japan', code: 'JP' },
    { name: 'China', code: 'CN' },
    { name: 'Taiwan', code: 'TW' },
    { name: 'Hong Kong', code: 'HK' },
    { name: 'Macau', code: 'MO' },
    { name: 'Thailand', code: 'TH' },
    { name: 'Vietnam', code: 'VN' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'Malaysia', code: 'MY' },
    { name: 'Singapore', code: 'SG' },
    { name: 'Cambodia', code: 'KH' },
    { name: 'Myanmar', code: 'MM' },
    { name: 'Laos', code: 'LA' },
    { name: 'India', code: 'IN' },
    { name: 'Sri Lanka', code: 'LK' },
    { name: 'Nepal', code: 'NP' },
    { name: 'Maldives', code: 'MV' },
    { name: 'Australia', code: 'AU' },
    { name: 'New Zealand', code: 'NZ' },
    { name: 'United Arab Emirates', code: 'AE' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Qatar', code: 'QA' },
    { name: 'Turkey', code: 'TR' },
    { name: 'Egypt', code: 'EG' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'France', code: 'FR' },
    { name: 'Germany', code: 'DE' },
    { name: 'Italy', code: 'IT' },
    { name: 'Spain', code: 'ES' },
    { name: 'Portugal', code: 'PT' },
    { name: 'Netherlands', code: 'NL' },
    { name: 'Switzerland', code: 'CH' },
    { name: 'Austria', code: 'AT' },
    { name: 'Czech Republic', code: 'CZ' },
    { name: 'Poland', code: 'PL' },
    { name: 'Hungary', code: 'HU' },
    { name: 'Greece', code: 'GR' },
    { name: 'Croatia', code: 'HR' },
    { name: 'Sweden', code: 'SE' },
    { name: 'Norway', code: 'NO' },
    { name: 'Denmark', code: 'DK' },
    { name: 'Finland', code: 'FI' },
    { name: 'Ireland', code: 'IE' },
    { name: 'Romania', code: 'RO' },
    { name: 'Russia', code: 'RU' },
    { name: 'United States', code: 'US' },
    { name: 'Canada', code: 'CA' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Argentina', code: 'AR' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'Morocco', code: 'MA' },
    { name: 'Kenya', code: 'KE' },
];

const COUNTRY_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
    COUNTRY_SEARCH_LIST.map(c => [c.name.toLowerCase(), c.code])
);

function extractCountryCode(placeName: string): string {
    const parts = placeName.split(',').map(s => s.trim());
    const last = parts[parts.length - 1].toLowerCase();
    return COUNTRY_NAME_TO_CODE[last] ?? '';
}

function matchCountries(query: string) {
    const q = query.toLowerCase().trim();
    return COUNTRY_SEARCH_LIST
        .filter(c => c.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map(c => ({
            type: 'country' as const,
            title: c.name,
            subtitle: 'Country · Browse all hotels',
            countryCode: c.code,
        }));
}

/**
 * Calls the backend's Duffel-powered airport search.
 * Used only when mode=flights so that IATA codes like "MNL" or "CRK"
 * resolve to real airports instead of generic Mapbox city names.
 *
 * Returns results shaped as { type: 'airport', title, subtitle, code }
 * where `code` is the IATA code that gets passed to /flights/search.
 */
async function fetchAirportsFromBackend(query: string) {
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
            // e.g. "Manila (MNL)" — the format DestinationInput displays
            title: `${airport.city} (${airport.iata})`,
            subtitle: `${airport.name} · ${airport.country}`,
            // `code` is what the search-form uses as the IATA value
            code: airport.iata,
            countryCode: '',
        }));
    } catch {
        return [];
    }
}

async function fetchCitiesFromMapbox(query: string) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return [];

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place,locality,region&limit=8&language=en&proximity=126.9780,37.5665&access_token=${token}`;

    try {
        const res = await fetch(url, { next: { revalidate: 300 } });
        if (!res.ok) return [];
        const data = await res.json();

        return (data.features ?? []).map((feature: any) => {
            const cityName = feature.text ?? '';
            const placeName = feature.place_name ?? '';
            const countryCtx = (feature.context ?? []).find((c: any) => c.id?.startsWith('country.'));
            const rawCode = countryCtx?.short_code ?? '';
            const countryCode = rawCode
                ? rawCode.toUpperCase().slice(0, 2)
                : extractCountryCode(placeName);

            return {
                type: 'city' as const,
                title: cityName,
                subtitle: placeName,
                countryCode,
                id: feature.id ?? undefined,
            };
        });
    } catch {
        return [];
    }
}

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('query') ?? '';
    // DestinationInput passes mode=flights when inside the Flights tab.
    // This switches the data source from Mapbox cities → backend airports.
    const mode  = req.nextUrl.searchParams.get('mode') ?? 'hotels';

    if (!query || query.length < 2) {
        return Response.json({ success: true, data: [] });
    }

    try {
        // ── Flight mode: airports from backend (Duffel Places API) ───────────
        if (mode === 'flights') {
            const airportResults = await fetchAirportsFromBackend(query);
            return Response.json({ success: true, data: airportResults });
        }

        // ── Hotel / general mode: countries + Mapbox cities ───────────────────
        const countryResults = matchCountries(query);
        const q = query.toLowerCase().trim();
        const isExactCountryMatch = countryResults.some(
            c => c.title.toLowerCase() === q || (c.title.toLowerCase().startsWith(q) && q.length >= 4)
        );

        if (isExactCountryMatch) {
            return Response.json({ success: true, data: countryResults });
        }

        const cityResults = await fetchCitiesFromMapbox(query);
        const data = [...countryResults, ...cityResults];

        return Response.json({ success: true, data });
    } catch {
        return Response.json({ success: false, error: 'Autocomplete failed' }, { status: 500 });
    }
}
