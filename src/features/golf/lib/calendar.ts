/**
 * Month-grid arithmetic for the tee-time date picker, ported from v1's `src/lib/golf/calendar.ts`.
 * Dates are "YYYY-MM-DD" and months "YYYY-MM" with no zone involved: a tee-time date is a date on
 * the course's clock, so it must not shift with the visitor's.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export interface CalendarDay {
    date: string;
    /** False for the leading and trailing days of the neighbouring months. */
    inMonth: boolean;
}

export const addDays = (date: string, days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Every date from `first` to `last`, inclusive. */
export function eachDay(first: string, last: string): string[] {
    const days: string[] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
    return days;
}

const dayOfWeek = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export function monthOf(date: string): string {
    return date.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** The weeks that cover `month`, whole weeks only, starting on Sunday. */
export function monthGrid(month: string): CalendarDay[] {
    const first = `${month}-01`;
    const lead = dayOfWeek(first);
    const [y, m] = month.split('-').map(Number);
    const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const weeks = Math.ceil((lead + length) / 7);
    const start = addDays(first, -lead);
    return Array.from({ length: weeks * 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, inMonth: monthOf(date) === month };
    });
}

/** Whether `date` may be chosen given inclusive bounds. */
export function isSelectable(date: string, min?: string, max?: string): boolean {
    return (!min || date >= min) && (!max || date <= max);
}

/** `date` moved into [min, max]; unchanged when it is already inside. */
export function clampDate(date: string, min?: string, max?: string): string {
    if (min && date < min) return min;
    if (max && date > max) return max;
    return date;
}
