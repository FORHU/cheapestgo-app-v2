import { http } from '@/shared/lib/http';
import type { Destination } from '@/shared/types';

/**
 * Destination suggestions for the search bar.
 *
 * Both modes are served by api-v2 (ADR-0017): hotels by the destination
 * autocomplete, which carries the granularity rung and bounding box the search
 * page needs to scope its map; flights by the airport index. The branch lives
 * here rather than behind one endpoint because the two return different things
 * from different sources, and folding them together is what previously
 * justified a route handler of our own.
 */

/**
 * What a suggestion lookup can actually return. The shared `Destination` union
 * is wider - it also covers 'history' and 'hotel', which come from recent
 * searches and result rows, never from this call.
 */
export type DestinationSuggestion = Omit<Destination, 'type' | 'countryCode'> & {
    type: 'city' | 'country' | 'airport';
    // Always present on a suggestion: api-v2 resolves it, and airports carry an
    // empty string. Optional on the shared type only because other sources omit it.
    countryCode: string;
};

interface AirportRow {
    iata:    string;
    name:    string;
    city:    string;
    country: string;
}

async function fetchAirports(query: string): Promise<DestinationSuggestion[]> {
    const res = await http.get<{ success: boolean; data: AirportRow[] }>(
        `/airports/search?q=${encodeURIComponent(query)}&limit=8`,
    );
    if (!res.success) return [];
    return res.data.map(airport => ({
        type:        'airport' as const,
        title:       `${airport.city} (${airport.iata})`,
        subtitle:    `${airport.name} · ${airport.country}`,
        code:        airport.iata,
        countryCode: '',
    }));
}

async function fetchDestinations(query: string, locale?: string): Promise<DestinationSuggestion[]> {
    const qs = new URLSearchParams({ query });
    if (locale) qs.set('locale', locale);
    const res = await http.get<{ success: boolean; data: DestinationSuggestion[] }>(
        `/hotels/destinations?${qs.toString()}`,
    );
    return res.success ? res.data : [];
}

export async function autocompleteDestinations(
    query: string,
    mode: 'hotels' | 'flights',
    locale?: string,
): Promise<DestinationSuggestion[]> {
    if (query.trim().length < 2) return [];
    try {
        return mode === 'flights'
            ? await fetchAirports(query.trim())
            : await fetchDestinations(query.trim(), locale);
    } catch {
        // A failed suggestion lookup should leave the field usable, not throw
        // into the component - the user can still type a destination by hand.
        return [];
    }
}
