'use client';

import { useLocale } from 'next-intl';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ACCENT, sortPalette } from './search-chrome';

/** Local-calendar `YYYY-MM-DD`; `toISOString` would shift the day east of UTC. */
export const isoDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = (s: string) => new Date(`${s}T00:00:00`);

/**
 * One month of days, with the chosen range lit — the calendar the search bars'
 * date panels open on. Shared by the stay editor (check-in to check-out) and the
 * flight trip editor (a departure, or a departure and return).
 *
 * It only draws: which click starts a range and which ends it is the caller's
 * rule, since a stay and a trip end theirs differently. Past days are disabled.
 */
export function RangeCalendar({
    tone, month, onMonth, start, end, onPick, roomy = false,
}: {
    tone: 'light' | 'dark';
    /** The first of the month on show. */
    month: Date;
    onMonth: (next: Date) => void;
    start: string;
    /** Empty while a range is half picked, or for a single day. */
    end: string;
    onPick: (day: string) => void;
    /**
     * Thumb-sized, for a phone's sheet: each day fills its column up to 44px, square, and the
     * month arrows are 40px. The popover's 36px days are a mouse's size.
     */
    roomy?: boolean;
}) {
    const locale = useLocale();
    const p = sortPalette(tone);

    const today = isoDay(new Date());
    const lead = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const weekdays = Array.from({ length: 7 }, (_, i) =>
        new Date(2026, 1, i + 1).toLocaleDateString(locale, { weekday: 'narrow' }));   // Feb 1 2026 is a Sunday

    const arrow = roomy ? 'h-10 w-10' : 'h-8 w-8';

    return (
        <>
            {/* Month header */}
            <div className="mb-2 flex items-center justify-between">
                <button
                    type="button"
                    aria-label="previous month"
                    disabled={month <= thisMonth}
                    onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    className={`flex ${arrow} items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30`}
                    style={{ background: p.hover }}>
                    <ChevronLeft size={15} />
                </button>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                </span>
                <button
                    type="button"
                    aria-label="next month"
                    onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    className={`flex ${arrow} items-center justify-center rounded-full cursor-pointer`}
                    style={{ background: p.hover }}>
                    <ChevronRight size={15} />
                </button>
            </div>

            {/* Calendar */}
            <div className="grid grid-cols-7 gap-y-1 text-center">
                {weekdays.map((w, i) => (
                    <span key={i} style={{ fontSize: roomy ? 12 : 11, opacity: 0.5, padding: '4px 0' }}>{w}</span>
                ))}
                {cells.map((d, i) => {
                    if (!d) return <span key={`e${i}`} />;
                    const day = isoDay(d);
                    const past = day < today;
                    const edge = day === start || day === end;
                    const inside = !!end && day > start && day < end;
                    return (
                        <button
                            key={day}
                            type="button"
                            disabled={past}
                            onClick={() => onPick(day)}
                            aria-label={d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            aria-pressed={edge}
                            className={`mx-auto flex ${roomy ? 'aspect-square w-full max-w-11' : 'h-9 w-9'} items-center justify-center rounded-full cursor-pointer disabled:cursor-default`}
                            style={{
                                fontSize: roomy ? 15 : 13,
                                fontWeight: edge ? 700 : 500,
                                opacity: past ? 0.3 : 1,
                                color: edge ? '#FFFFFF' : p.text,
                                background: edge ? ACCENT : inside ? p.hover : 'transparent',
                            }}>
                            {d.getDate()}
                        </button>
                    );
                })}
            </div>
        </>
    );
}
