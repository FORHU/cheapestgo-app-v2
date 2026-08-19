import { getSqlAdmin } from '@/server/db/postgres';
import { CITY_ALIASES, resolveHotelDbCity } from '@/server/constants/cityAliases';
import { COUNTRY_SEARCH_LIST, extractCountryCode } from '@/server/constants/countries';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DestinationRung = 'country' | 'province' | 'city' | 'district' | 'poi';

export interface AutocompleteResult {
    type: 'city' | 'country';
    rung: DestinationRung;
    title: string;
    subtitle: string;
    countryCode: string;
    id?: string;
    code?: string;
    lat?: number;
    lng?: number;
    bbox?: [number, number, number, number];
    districtName?: string;
    canonicalCity?: string;
}

// ─── Destination code resolver ────────────────────────────────────────────────

// In-process cache — avoids repeat DB lookups within the same server process
const _destCodeCache = new Map<string, string>();

/** Overwrite an entry in the in-process dest code cache. */
export function setDestCodeCache(cityKey: string, destCode: string): void {
    _destCodeCache.set(cityKey.toLowerCase().trim(), destCode);
}

/**
 * Resolve a TravelgateX destination code for a given city.
 * Checks in-process cache → DB → TGX API (in that order).
 * Writes back to DB so future lookups skip the TGX API call entirely.
 */
export async function resolveTgxDestinationCode(cityName: string, countryCode?: string): Promise<string | undefined> {
    const key = countryCode
        ? `${cityName.toLowerCase().trim()}:${countryCode.toLowerCase()}`
        : cityName.toLowerCase().trim();

    // 1. In-process cache (fastest)
    if (_destCodeCache.has(key)) {
        const cached = _destCodeCache.get(key)!;
        return cached === 'NONE' ? undefined : cached;
    }

    // 2. DB cache (fast, survives server restarts)
    const cityOnlyKey = cityName.toLowerCase().trim();
    try {
        const sql = getSqlAdmin();
        const rows = await sql`SELECT destination_code FROM tgx_destination_cache WHERE city_key = ${key} LIMIT 1`;
        if (rows.length > 0) {
            const code = rows[0].destination_code as string;
            if (code === 'NONE') { _destCodeCache.set(key, 'NONE'); return undefined; }
            _destCodeCache.set(key, code);
            return code;
        }
        // Fallback: sync-dest-cache stores codes without the ":countryCode" suffix.
        if (key !== cityOnlyKey) {
            const cityRows = await sql`SELECT destination_code FROM tgx_destination_cache WHERE city_key = ${cityOnlyKey} LIMIT 1`;
            if (cityRows.length > 0) {
                const code = cityRows[0].destination_code as string;
                if (code === 'NONE') { _destCodeCache.set(key, 'NONE'); return undefined; }
                _destCodeCache.set(key, code);
                return code;
            }
        }
    } catch { /* non-fatal — fall through to TGX */ }

    // 3. TGX API — race against 18s so the search stream isn't blocked
    return Promise.race([
        _fetchDestCodeRaw(cityName, countryCode),
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 18_000)),
    ]);
}

// In-flight raw TGX dest-code fetches, keyed by city_key.
// Shared so resolveTgxDestinationCode and backgroundResolveDestCode
// both await the SAME underlying HTTP call.
const _bgResolvingPromises = new Map<string, Promise<string | undefined>>();

/**
 * Shared raw TGX destinationSearcher fetch — no AbortSignal, no timeout.
 * Result is cached in _destCodeCache and DB so future calls are instant.
 */
function _fetchDestCodeRaw(cityName: string, countryCode?: string): Promise<string | undefined> {
    const key = countryCode
        ? `${cityName.toLowerCase().trim()}:${countryCode.toLowerCase()}`
        : cityName.toLowerCase().trim();

    if (_destCodeCache.has(key)) {
        const cached = _destCodeCache.get(key)!;
        return Promise.resolve(cached === 'NONE' ? undefined : cached);
    }
    const existing = _bgResolvingPromises.get(key);
    if (existing) return existing;

    const promise = (async (): Promise<string | undefined> => {
        try {
            const { getTgxConfig } = await import('@/server/stays/travelgatex/client');
            const cfg = getTgxConfig();
            if (!cfg.apiKey) return undefined;
            const DEST_QUERY = `query TgxResolveCity($access: ID!, $text: String!, $maxSize: Int) {
                   hotelX {
                     destinationSearcher(criteria: { access: $access, text: $text, maxSize: $maxSize }) {
                       ... on DestinationData { code type texts { text language } }
                     }
                   }
                 }`;
            const res = await fetch(cfg.endpoint, {
                method:  'POST',
                headers: { 'Authorization': `Apikey ${cfg.apiKey}`, 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
                body:    JSON.stringify({ query: DEST_QUERY, variables: { access: cfg.accessCode, text: cityName, maxSize: 50 } }),
            });
            if (!res.ok) {
                console.warn(`[dest-resolve] HTTP ${res.status} for "${cityName}"`);
                if (res.status >= 500) {
                    try {
                        const sql = getSqlAdmin();
                        await sql`INSERT INTO tgx_destination_cache (city_key, destination_code)
                                  VALUES (${key}, 'NONE') ON CONFLICT (city_key) DO NOTHING`;
                        console.log(`[dest-resolve] Marked "${cityName}" as NONE (HTTP ${res.status})`);
                    } catch { /* non-fatal */ }
                }
                return undefined;
            }
            const result = await res.json();
            const items: any[] = result?.data?.hotelX?.destinationSearcher ?? [];
            const exactName = cityName.toLowerCase();
            const matchesName = (i: any) =>
                (i.texts ?? []).some((t: any) => t.language === 'en' && t.text.toLowerCase() === exactName);
            const cityItem = items.find((i: any) => i.type === 'CITY' && matchesName(i)) ?? items.find((i: any) => i.type === 'CITY');
            const zoneItem = items.find((i: any) => i.type === 'ZONE' && matchesName(i)) ?? items.find((i: any) => i.type === 'ZONE');
            const selectedItem = countryCode ? (zoneItem ?? cityItem) : (cityItem ?? zoneItem);
            const code      = selectedItem?.code as string | undefined;
            const dest_type = selectedItem?.type as string | undefined;
            if (code) {
                _destCodeCache.set(key, code);
                try {
                    const sql = getSqlAdmin();
                    await sql`INSERT INTO tgx_destination_cache (city_key, destination_code, dest_type)
                        VALUES (${key}, ${code}, ${dest_type ?? 'CITY'})
                        ON CONFLICT (city_key) DO UPDATE SET
                            destination_code = EXCLUDED.destination_code,
                            dest_type        = EXCLUDED.dest_type
                        WHERE tgx_destination_cache.destination_code != 'NONE'`;
                    console.log(`[dest-resolve] Resolved "${cityName}" → ${code} (${dest_type ?? 'CITY'})`);
                } catch { /* non-fatal */ }
            } else {
                console.warn(`[dest-resolve] No code found for "${cityName}"`);
            }
            return code;
        } catch (e: any) {
            console.warn(`[dest-resolve] Raw fetch failed for "${cityName}":`, e.message?.slice(0, 100));
            return undefined;
        } finally {
            _bgResolvingPromises.delete(key);
        }
    })();

    _bgResolvingPromises.set(key, promise);
    return promise;
}

/**
 * Start (or join) a background dest-code resolution and return its Promise.
 */
export function backgroundResolveDestCode(cityName: string, countryCode?: string): Promise<string | undefined> {
    return _fetchDestCodeRaw(cityName, countryCode);
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

function mapboxTypeToRung(placeType: string): DestinationRung {
    switch (placeType) {
        case 'country':       return 'country';
        case 'region':        return 'province';
        case 'place':         return 'city';
        case 'district':
        case 'locality':
        case 'neighborhood':  return 'district';
        default:              return 'poi';
    }
}

function matchCountries(query: string): AutocompleteResult[] {
    const q = query.toLowerCase().trim();
    return COUNTRY_SEARCH_LIST
        .filter(c => c.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map(c => ({
            type: 'country' as const,
            rung: 'country' as const,
            title: c.name,
            subtitle: 'Country · Browse all hotels',
            countryCode: c.code,
        }));
}

function mapboxLang(locale?: string): string {
    switch (locale) {
        case 'ko': return 'ko';
        case 'ja': return 'ja';
        case 'zh': return 'zh-Hans';
        default:   return 'en';
    }
}

async function fetchCitiesFromMapbox(query: string, locale?: string): Promise<AutocompleteResult[]> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return [];

    const lang = mapboxLang(locale);
    const language = lang === 'en' ? 'en' : `${lang},en`;
    const types = 'region,place,district,locality,neighborhood,poi';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=${types}&limit=8&language=${language}&proximity=126.9780,37.5665&access_token=${token}`;

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();

        const mapped = (data.features ?? []).map((feature: any) => {
            const cityName = feature.text_en ?? feature.text ?? '';
            const placeName = feature.place_name ?? '';
            const countryCtx = (feature.context ?? []).find((c: any) => c.id?.startsWith('country.'));
            const rawCode = countryCtx?.short_code ?? '';
            const countryCode = rawCode
                ? rawCode.toUpperCase().slice(0, 2)
                : extractCountryCode(placeName, cityName);

            const placeType: string = (feature.place_type ?? [])[0] ?? 'place';
            const rung = mapboxTypeToRung(placeType);
            const center: [number, number] | undefined = Array.isArray(feature.center) ? feature.center : undefined;
            const bbox: [number, number, number, number] | undefined =
                Array.isArray(feature.bbox) && feature.bbox.length === 4 ? feature.bbox : undefined;

            let aliasedCity: string | undefined;
            {
                const nameLower = cityName.toLowerCase();
                const placeNameLower = placeName.toLowerCase();
                const countryMap = CITY_ALIASES[countryCode];
                if (countryMap) {
                    const qualifiedKey = Object.keys(countryMap)
                        .filter(key => {
                            if (!key.startsWith(nameLower + ' ') && !key.startsWith(nameLower + '-')) return false;
                            const qualifier = key.slice(nameLower.length + 1);
                            return qualifier.length > 0 && placeNameLower.includes(qualifier);
                        })
                        .sort((a, b) => b.length - a.length)[0];

                    if (qualifiedKey) {
                        aliasedCity = countryMap[qualifiedKey];
                    } else {
                        const exactKey = Object.keys(countryMap).find(key => nameLower === key);
                        if (exactKey) {
                            aliasedCity = countryMap[exactKey];
                        } else {
                            const prefixKey = Object.keys(countryMap)
                                .filter(key => nameLower.startsWith(key + ' ') || nameLower.startsWith(key + '-'))
                                .sort((a, b) => b.length - a.length)[0];
                            aliasedCity = prefixKey ? countryMap[prefixKey] : undefined;
                        }
                    }
                }
            }

            let effectiveBbox = bbox;
            if (aliasedCity && !effectiveBbox && center) {
                const [lng, lat] = center;
                const latDelta = 0.045;
                const lngDelta = latDelta / Math.cos(lat * Math.PI / 180);
                effectiveBbox = [
                    +(lng - lngDelta).toFixed(6),
                    +(lat - latDelta).toFixed(6),
                    +(lng + lngDelta).toFixed(6),
                    +(lat + latDelta).toFixed(6),
                ];
            }

            return {
                type: 'city' as const,
                rung: aliasedCity ? 'city' : rung,
                title: cityName,
                subtitle: placeName,
                countryCode,
                id: feature.id ?? undefined,
                lat: center ? center[1] : undefined,
                lng: center ? center[0] : undefined,
                bbox: effectiveBbox,
                districtName: aliasedCity ? cityName : undefined,
                canonicalCity: aliasedCity,
            };
        });

        const seen = new Set<string>();
        return mapped.filter((r: AutocompleteResult) => {
            const key = r.canonicalCity
                ? `${r.canonicalCity.toLowerCase()}|${r.countryCode}`
                : `${r.title.toLowerCase()}|${r.countryCode}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch {
        return [];
    }
}

async function filterCitiesWithHotels(
    cities: Array<{ title: string; countryCode: string; canonicalCity?: string }>
): Promise<Set<string>> {
    if (!cities.length) return new Set();
    try {
        const sql = getSqlAdmin();
        const pairs = cities.map(c => {
            const canonical = (c.canonicalCity ?? c.title).toLowerCase();
            const dbCity = resolveHotelDbCity(c.canonicalCity ?? c.title, c.countryCode).toLowerCase();
            return { canonical, dbCity, country: c.countryCode.toLowerCase() };
        });
        const cityNames = pairs.map(p => p.dbCity);
        const rows = await sql`
            SELECT DISTINCT LOWER(city) AS city, LOWER(country) AS country
            FROM hotel_content
            WHERE LOWER(city) = ANY(${cityNames})
        `;
        const matched = new Set(rows.map((r: any) => `${r.city}|${r.country}`));
        const result = new Set<string>();
        for (const p of pairs) {
            if (matched.has(`${p.dbCity}|${p.country}`)) result.add(p.canonical);
        }
        if (result.size === 0) {
            const cityOnlyMatched = new Set(rows.map((r: any) => r.city as string));
            for (const p of pairs) {
                if (cityOnlyMatched.has(p.dbCity)) result.add(p.canonical);
            }
        }
        return result;
    } catch {
        return new Set(cities.map(c => (c.canonicalCity ?? c.title).toLowerCase()));
    }
}

async function fetchAutocomplete(query: string, locale?: string): Promise<AutocompleteResult[]> {
    const countryResults = matchCountries(query);
    const cityResults = await fetchCitiesFromMapbox(query, locale);
    if (!cityResults.length) return countryResults;

    const citiesWithHotels = await filterCitiesWithHotels(cityResults);
    const sorted = [
        ...cityResults.filter(c => citiesWithHotels.has((c.canonicalCity ?? c.title).toLowerCase())),
        ...cityResults.filter(c => !citiesWithHotels.has((c.canonicalCity ?? c.title).toLowerCase())),
    ];
    return [...countryResults, ...sorted];
}

export async function autocompleteDestinations(
    query: string,
    locale?: string,
): Promise<{ success: true; data: AutocompleteResult[] } | { success: false; error: string }> {
    if (!query || query.length < 2) return { success: true, data: [] };

    try {
        const data = await fetchAutocomplete(query, locale);
        return { success: true, data };
    } catch (error) {
        console.error('[autocompleteDestinations] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Autocomplete failed' };
    }
}
