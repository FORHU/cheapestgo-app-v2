'use client';

import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Minus, Plus } from 'lucide-react';
import { ACCENT, sortPalette } from './search-chrome';
import { RangeCalendar, parseDay as parse } from './range-calendar';
import { BarSheet, opensAsSheet } from './bar-sheet';

export interface Stay {
    checkIn:  string;   // YYYY-MM-DD
    checkOut: string;
    adults:   number;
    children: number;
    rooms:    number;
}

/**
 * The stay on the search page's bar — dates and guests — as a control rather than
 * text. It used to be read-only: changing a date meant going back to the landing page
 * and starting the search over.
 *
 * Edits are drafted in the panel and only reach the search on "Done", so stepping
 * through a calendar does not fire a search per click. "Done" without a check-out
 * keeps the panel open: half a stay is not a search.
 *
 * From `md` up the panel hangs under the button. On a phone it is a sheet along the
 * bottom of the screen (`BarSheet`), with thumb-sized days and steppers: the popover
 * opened leftwards from a button that, on a narrow phone, sits at the bar's left
 * edge, and so landed off the screen.
 */
export function StayEditor({ tone, onApply, ...stay }: Stay & {
    tone: 'light' | 'dark';
    onApply: (next: Stay) => void;
}) {
    const t = useTranslations('landing.search');
    const tAll = useTranslations();
    const locale = useLocale();
    const p = sortPalette(tone);

    const [open, setOpen] = useState(false);
    /** Whether this opening is a sheet (a phone) rather than the popover. */
    const [sheet, setSheet] = useState(false);
    const [draft, setDraft] = useState<Stay>(stay);
    const [month, setMonth] = useState(() => { const d = parse(stay.checkIn); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const wrapRef = useRef<HTMLDivElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Each opening starts from the stay being searched, not an abandoned draft.
    const toggle = () => {
        if (!open) {
            setDraft(stay);
            const d = parse(stay.checkIn);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            setSheet(opensAsSheet());
        }
        setOpen(o => !o);
    };

    useEffect(() => {
        if (!open) return;
        // The sheet is rendered into <body>, outside the wrapper; a press in it is not outside.
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!wrapRef.current?.contains(target) && !sheetRef.current?.contains(target)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const fmtShort = (s: string) => parse(s).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const guests = stay.adults + stay.children;
    const label = `${fmtShort(stay.checkIn)} – ${fmtShort(stay.checkOut)} · ${tAll('property.bookingWidget.guests', { count: guests })}`;

    // Clicking a day: a first click, or one on/before check-in, starts a new range.
    const pickDay = (day: string) => setDraft(d =>
        d.checkIn && !d.checkOut && day > d.checkIn
            ? { ...d, checkOut: day }
            : { ...d, checkIn: day, checkOut: '' });

    const done = () => {
        if (!draft.checkIn || !draft.checkOut) return;
        setOpen(false);
        onApply(draft);
    };

    const counters: { key: 'adults' | 'children' | 'rooms'; label: string; min: number; max: number }[] = [
        { key: 'adults',   label: t('adults'),   min: 1, max: 16 },
        { key: 'children', label: t('children'), min: 0, max: 10 },
        { key: 'rooms',    label: t('rooms'),    min: 1, max: 8 },
    ];

    // The same calendar, guests and Done in the popover and the sheet; the sheet's are sized for
    // a thumb — 44px days and steppers, a 48px Done — where the popover's are a mouse's.
    const step = sheet ? 'h-11 w-11' : 'h-7 w-7';
    const editor = (
        <>
            <RangeCalendar
                tone={tone}
                month={month}
                onMonth={setMonth}
                start={draft.checkIn}
                end={draft.checkOut}
                onPick={pickDay}
                roomy={sheet}
            />

            {/* Guests */}
            <div className={`flex flex-col pt-3 ${sheet ? 'mt-4 gap-1.5' : 'mt-3 gap-2.5'}`} style={{ borderTop: `1px solid ${p.border}` }}>
                {counters.map(c => (
                    <div key={c.key} className="flex items-center justify-between">
                        <span style={{ fontSize: sheet ? 15 : 13, fontWeight: 600 }}>{c.label}</span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                aria-label={`Remove ${c.label}`}
                                disabled={draft[c.key] <= c.min}
                                onClick={() => setDraft(d => ({ ...d, [c.key]: d[c.key] - 1 }))}
                                className={`flex ${step} items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30`}
                                style={{ border: `1px solid ${p.border}` }}>
                                <Minus size={sheet ? 16 : 13} />
                            </button>
                            <span className="w-5 text-center" style={{ fontSize: sheet ? 16 : 14, fontWeight: 700 }}>{draft[c.key]}</span>
                            <button
                                type="button"
                                aria-label={`Add ${c.label}`}
                                disabled={draft[c.key] >= c.max}
                                onClick={() => setDraft(d => ({ ...d, [c.key]: d[c.key] + 1 }))}
                                className={`flex ${step} items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30`}
                                style={{ border: `1px solid ${p.border}` }}>
                                <Plus size={sheet ? 16 : 13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

        </>
    );
    // In the popover Done ends the panel; in the sheet it is the pinned footer, so a short phone
    // that has to scroll the calendar still has it in view.
    const doneButton = (
        <button
            type="button"
            onClick={done}
            disabled={!draft.checkOut}
            className={`w-full rounded-full cursor-pointer disabled:cursor-default disabled:opacity-50 ${sheet ? 'h-12' : 'mt-4 h-10'}`}
            style={{ background: ACCENT, color: '#FFFFFF', fontSize: sheet ? 15 : 14, fontWeight: 700, border: 'none' }}>
            {t('done')}
        </button>
    );

    return (
        <div ref={wrapRef} className="relative shrink-0">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label={label}
                title={tAll('property.rooms.changeDates')}
                className="flex h-9 items-center gap-2 rounded-full px-2.5 cursor-pointer transition-opacity hover:opacity-80 md:h-10 md:px-4"
                style={{ background: p.field, border: `1px solid ${p.border}`, color: p.text, fontSize: 13, fontWeight: 600 }}
            >
                <CalendarDays size={15} className="shrink-0" />
                {/* Spelled out wherever the toolbar has the width: from `sm`, where
                    the field's row still has room beside it, but not at `lg`, where
                    the bar goes back to one row and the label would crush the field. */}
                <span className="hidden whitespace-nowrap sm:inline lg:hidden xl:inline">{label}</span>
            </button>

            {sheet ? (
                <BarSheet open={open} title={tAll('property.rooms.changeDates')} tone={tone} onClose={() => setOpen(false)} sheetRef={sheetRef} footer={doneButton}>
                    {editor}
                </BarSheet>
            ) : (
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.12 }}
                            role="dialog"
                            aria-label={tAll('property.rooms.changeDates')}
                            // Below `lg` the button ends the field's row at the bar's right edge, so the
                            // panel opens leftwards from it; from `lg` the bar is one row and the button
                            // sits mid-bar, so it opens rightwards. Either way it stays on the screen.
                            className="absolute right-0 z-50 w-[320px] lg:left-0 lg:right-auto"
                            style={{ top: '100%', marginTop: 8, padding: 16, borderRadius: 18, background: p.menu, border: `1px solid ${p.border}`, boxShadow: p.shadow, color: p.text }}
                        >
                            {editor}
                            {doneButton}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
