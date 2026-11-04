/**
 * An amount that is about to be charged, or has been: to the unit the currency actually has, so
 * `$210.37` is never shown as `$210`. `formatCurrency` rounds to whole units, which suits a guide
 * price and would make the figure on the page differ from the figure on the card.
 */
export function money(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

/** A 12-hour clock, in the visitor's language: "7:30 AM", "오전 7:30", "午前7:30", "上午7:30". */
function clock(at: Date | number, locale: string, timeZone: string): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
        .format(at)
        // Node's ICU puts U+202F before "AM" where browsers put a space: one text on server and client.
        .replace(/ /g, ' ');
}

/** "07:30", as api-v2 sends a time on the course's clock, as the visitor should read it. */
export function clockTime(localTime: string, locale: string): string {
    const [hours, minutes] = localTime.split(':').map(Number);
    return clock(Date.UTC(2000, 0, 1, hours, minutes), locale, 'UTC');
}

/** A tee time on the course's own clock: where the visitor is has no bearing on when it starts. */
export function teeTimeLabels(startsAt: string, timezone: string | null, locale: string): { date: string; time: string } {
    const at = new Date(startsAt);
    const timeZone = timezone ?? 'UTC';
    const dateLocale = locale === 'en' ? 'en-GB' : locale;
    return {
        date: new Intl.DateTimeFormat(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(at),
        time: clock(at, locale, timeZone),
    };
}
