/**
 * "Monday from 9:00 AM (Asia/Manila)" — when the team is next available.
 *
 * Formatted here rather than baked into the stored notice. The message row is permanent
 * and the schedule is not, so a time written into it becomes confidently wrong the moment
 * someone edits the hours in the Support Desk. Rendered live, it stays true.
 *
 * The timezone is named because the customer is very often not in it: a Korean customer on
 * GeomeeGo reading "9:00 AM" without being told whose 9am has been told nothing.
 */

export interface ReopenOpening {
    day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
    open: string;
    timezone: string;
    today: boolean;
}

/** Any Sunday, used only to turn a day key into a localised weekday name. */
const REFERENCE_SUNDAY = Date.UTC(2026, 0, 4);
const DAY_INDEX: Record<ReopenOpening['day'], number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export interface ReopenText {
    /** True when it is later the same day, so the panel can say "today" in its own words. */
    today: boolean;
    /** "Monday 9:00 AM (Asia/Manila)", or without the weekday when it is today. */
    when: string;
}

export function formatReopen(opening: ReopenOpening | null, locale: string): ReopenText | null {
    if (!opening) return null;

    const match = /^(\d{2}):(\d{2})$/.exec(opening.open);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;

    try {
        const time = new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
        }).format(Date.UTC(2026, 0, 4, hours, minutes));

        if (opening.today) {
            // No weekday: "back Monday from 9:00" read at 7am on Monday is a puzzle. The
            // word "today" belongs to the panel, which has it in four languages.
            return { today: true, when: `${time} (${opening.timezone})` };
        }

        const weekday = new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            timeZone: 'UTC',
        }).format(REFERENCE_SUNDAY + DAY_INDEX[opening.day] * 86_400_000);

        return { today: false, when: `${weekday} ${time} (${opening.timezone})` };
    } catch {
        // An unknown locale or a value we cannot format. Saying nothing beats saying
        // "back on Invalid Date" to someone already waiting.
        return null;
    }
}
