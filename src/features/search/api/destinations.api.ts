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

async function fetchAirports(query: string, signal?: AbortSignal): Promise<DestinationSuggestion[]> {
    const res = await http.get<{ success: boolean; data: AirportRow[] }>(
        `/airports/search?q=${encodeURIComponent(query)}&limit=8`,
        { signal },
    );
    if (!res.success) return [];
    return res.data.map(airport => ({
        type:        'airport' as const,
        title:       `${airport.city} (${airport.iata})`,
        // A city code (OSA, TYO) has no country of its own; no trailing dot for it.
        subtitle:    [airport.name, airport.country].filter(Boolean).join(' · '),
        code:        airport.iata,
        countryCode: '',
    }));
}

async function fetchDestinations(
    query: string,
    locale?: string,
    signal?: AbortSignal,
): Promise<DestinationSuggestion[]> {
    const qs = new URLSearchParams({ query });
    if (locale) qs.set('locale', locale);
    const res = await http.get<{ success: boolean; data: DestinationSuggestion[] }>(
        `/hotels/destinations?${qs.toString()}`,
        { signal },
    );
    return res.success ? res.data : [];
}

/**
 * Suggestions for what was typed, or `null` if we could not find out.
 *
 * The difference matters to whoever is drawing the panel. An empty array is an answer — we
 * looked and there is no such place — and a panel saying so is correct. A dropped request is
 * not an answer, and both used to arrive here as `[]`, so a flaky connection emptied a list of
 * perfectly good suggestions and the field read as broken.
 *
 * Still never throws: a caller mid-keystroke has nothing useful to do with an exception.
 */
export async function autocompleteDestinations(
    query: string,
    mode: 'hotels' | 'flights',
    locale?: string,
    signal?: AbortSignal,
): Promise<DestinationSuggestion[] | null> {
    if (query.trim().length < 2) return [];
    try {
        return mode === 'flights'
            ? await fetchAirports(query.trim(), signal)
            : await fetchDestinations(query.trim(), locale, signal);
    } catch {
        // Including an abort, which is this module's own doing and never a reason to redraw.
        return null;
    }
}
