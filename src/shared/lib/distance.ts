/**
 * Distances as the viewer reads them — kilometres or miles.
 *
 * The one place a distance becomes text. Every surface that shows one (the property page's nearby
 * places, the search map's place popups) formats through here, so a viewer who picks miles sees
 * miles everywhere rather than on whichever screens remembered to ask.
 */

export type DistanceUnit = 'km' | 'mi';

/** Where miles are the everyday unit for road distances. */
const MILES_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
const EARTH_RADIUS_M = 6_371_000;

/**
 * The unit to start a viewer on, from their browser's languages: the first tag that names a region
 * decides. A bare `en` names none, so it does not count as American.
 */
export function guessDistanceUnit(languages: readonly string[]): DistanceUnit {
    for (const tag of languages) {
        let region: string | undefined;
        try {
            region = new Intl.Locale(tag).region;
        } catch {
            continue;
        }
        if (region) return MILES_REGIONS.has(region) ? 'mi' : 'km';
    }
    return 'km';
}

type FormatUnit = 'meter' | 'kilometer' | 'foot' | 'mile';

/** Map markers format on every render, and building an Intl.NumberFormat is the costly part. */
const formatters = new Map<string, Intl.NumberFormat>();

function unitFormat(locale: string, value: number, unit: FormatUnit, digits: number) {
    const key = `${locale}|${unit}|${digits}`;
    let format = formatters.get(key);
    if (!format) {
        format = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: digits });
        formatters.set(key, format);
    }
    return format.format(value);
}

/**
 * `meters` as text: metres under a kilometre, feet under a tenth of a mile, otherwise one decimal.
 * Short distances round to 10 — "350 m", not "347 m" — which is all a walk needs.
 * A distance that is not a number shows as a dash; a negative one counts as zero.
 */
export function formatDistance(distance: number, unit: DistanceUnit, locale = 'en'): string {
    if (!Number.isFinite(distance)) return '—';
    const meters = Math.max(0, distance);
    if (unit === 'km') {
        const rounded = Math.round(meters / 10) * 10;
        return rounded < 1000
            ? unitFormat(locale, rounded, 'meter', 0)
            : unitFormat(locale, meters / 1000, 'kilometer', 1);
    }
    const miles = meters / METERS_PER_MILE;
    return miles < 0.1
        ? unitFormat(locale, Math.round((meters * FEET_PER_METER) / 10) * 10, 'foot', 0)
        : unitFormat(locale, miles, 'mile', 1);
}

/** Search-radius steps, in metres, that read as round numbers in each unit. */
export const RADIUS_OPTIONS: Record<DistanceUnit, readonly number[]> = {
    km: [1000, 2000, 5000, 10000],
    mi: [805, 1609, 4828, 8047],
};

/** The step in `unit` closest to `meters` — where the radius lands when the unit flips. */
export function nearestRadius(meters: number, unit: DistanceUnit): number {
    return RADIUS_OPTIONS[unit].reduce((best, step) =>
        Math.abs(step - meters) < Math.abs(best - meters) ? step : best);
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
