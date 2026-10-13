export interface HoursGroup {
    text: string;
    includesToday: boolean;
}

/**
 * Google's seven "Day: hours" lines, with runs of identical hours folded together —
 * "Monday - Friday: 9 AM – 5 PM" rather than five lines saying the same thing.
 *
 * `today` is the English weekday name (Google's lines are English: the API is called with
 * language=en), passed in so this stays a pure function.
 */
export function groupOpeningHours(weekdayText: readonly string[] | undefined, today: string): HoursGroup[] {
    if (!weekdayText?.length) return [];

    const parsed = weekdayText.map((line) => {
        const match = line.match(/^(.+?):\s*(.+)$/);
        return match ? { day: match[1].trim(), hours: match[2].trim() } : { day: line.trim(), hours: '' };
    });

    const groups: { start: string; end: string; hours: string; days: string[] }[] = [];
    for (const { day, hours } of parsed) {
        const last = groups[groups.length - 1];
        if (last && hours !== '' && last.hours === hours) {
            last.end = day;
            last.days.push(day);
        } else {
            groups.push({ start: day, end: day, hours, days: [day] });
        }
    }

    return groups.map((g) => ({
        text: g.hours === '' ? g.start : `${g.start === g.end ? g.start : `${g.start} - ${g.end}`}: ${g.hours}`,
        includesToday: g.days.some((d) => d.toLowerCase() === today.toLowerCase()),
    }));
}
