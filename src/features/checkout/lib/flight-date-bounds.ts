/**
 * The dates a flight passenger's details may take, so the date picker offers only those.
 *
 * An airline judges a passenger's age on the day they fly: an adult is twelve or over, a
 * child two to eleven, an infant under two. A date of birth outside the passenger's band is
 * refused when the order is placed — which, since the card is now held before the airline is
 * asked, is after the traveller has paid. A passport that has expired by departure is refused
 * at the airport. Both are cheaper to prevent at the form.
 *
 * Dates are local-calendar `YYYY-MM-DD` strings throughout, compared as strings.
 */

export interface DateBounds {
    min:    string;
    max:    string;
    /** Where the picker opens when nothing is chosen yet: a likely date, inside the bounds. */
    anchor: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `iso` moved by whole years; a 29 February that does not exist in the result becomes the 28th. */
function addYears(iso: string, years: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const year = y + years;
    const lastDay = new Date(year, m, 0).getDate();
    return `${year}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
}

function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const clamp = (iso: string, min: string, max: string) => (iso < min ? min : iso > max ? max : iso);
const earlier = (a: string, b: string) => (a < b ? a : b);

/**
 * @param departure The first flight's date; today when unknown.
 * @param today     Local `YYYY-MM-DD`.
 */
export function birthDateBounds(type: 'ADT' | 'CHD' | 'INF', departure: string, today: string): DateBounds {
    const on = departure || today;
    const bands = {
        ADT: { min: addYears(on, -120),              max: addYears(on, -12), likely: addYears(on, -30) },
        CHD: { min: addDays(addYears(on, -12), 1),   max: addYears(on, -2),  likely: addYears(on, -7) },
        INF: { min: addDays(addYears(on, -2), 1),    max: on,                likely: addYears(on, -1) },
    }[type];
    // Nobody is booked before they are born.
    const max = earlier(bands.max, today);
    return { min: bands.min, max, anchor: clamp(bands.likely, bands.min, max) };
}

/** Valid on the day of departure; passports run ten years, so twenty is a generous ceiling. */
export function passportExpiryBounds(departure: string, today: string): DateBounds {
    const min = departure || today;
    return { min, max: addYears(today, 20), anchor: min };
}
