/**
 * How many nights a stay covers, and how to restate a stay's price per night.
 *
 * Suppliers quote a **Stay Total** — one figure for the whole date range — while the
 * storefront advertises a **Nightly Rate**. Converting between them needs the night
 * count, and it must be the count the price was quoted for.
 *
 * This exists because the same arithmetic was written out eight times across the app,
 * and the copies had already drifted: four were identical, `booking-card` omitted the
 * `Math.max(1, …)` floor and could return zero or a negative, and `booking-summary`
 * kept a private helper. In v1 that same shape produced a live incident — a two-night
 * total rendered as a nightly rate, so every affected room advertised at double its
 * real price, with nothing anywhere reporting an error. See ADR-0020.
 *
 * app-v2 does not have that bug today, but only because api-v2 declines to price a
 * stay it has no dates for. That is one plausible change away from being untrue, and
 * a single definition is what keeps it from mattering.
 */

const MS_PER_NIGHT = 86_400_000;

export type DateInput = string | Date | null | undefined;

function toTime(value: DateInput): number | null {
    if (!value) return null;
    const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}

/**
 * Nights between two dates, or null when the stay is not known.
 *
 * Null rather than a default: a caller that cannot say how long the stay is should
 * decide for itself what to show, not silently be handed "1" and divide by it. That
 * substitution is exactly what turned a stay total into a nightly rate in v1.
 *
 * Never returns less than 1 for a stay it *can* read — a same-day or reversed range
 * is a bad input, and dividing a real price by zero is worse than treating it as one
 * night.
 */
export function nightsBetween(checkIn: DateInput, checkOut: DateInput): number | null {
    const ci = toTime(checkIn);
    const co = toTime(checkOut);
    if (ci === null || co === null) return null;

    // Counted in calendar days, not 24-hour periods. A guest arriving at 15:00 and
    // leaving at 11:00 two days later has stayed two nights, but the elapsed time is
    // 44 hours and dividing by 24 rounds that to one. Every caller today passes a
    // pure date — `bookings.check_in` is `@db.Date` and URL params are `YYYY-MM-DD`,
    // both of which parse to midnight UTC — so this changes nothing now and stops a
    // caller that later passes a real arrival time from silently losing a night.
    const startOfDay = (t: number) => {
        const d = new Date(t);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };

    return Math.max(1, Math.round((startOfDay(co) - startOfDay(ci)) / MS_PER_NIGHT));
}

/**
 * Restate a stay total as a nightly rate.
 *
 * Returns null when the night count is unknown, so a caller has to handle not knowing
 * rather than displaying the stay total as if it were one night's price.
 */
export function perNight(stayTotal: number, nights: number | null): number | null {
    if (nights === null || !Number.isFinite(stayTotal)) return null;
    return stayTotal / Math.max(1, nights);
}
