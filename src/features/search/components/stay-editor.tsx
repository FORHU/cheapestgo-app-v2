'use client';

import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Minus, Plus } from 'lucide-react';
import { ACCENT, sortPalette } from './search-chrome';
import { RangeCalendar, parseDay as parse } from './range-calendar';

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
    const [draft, setDraft] = useState<Stay>(stay);
    const [month, setMonth] = useState(() => { const d = parse(stay.checkIn); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const wrapRef = useRef<HTMLDivElement>(null);

    // Each opening starts from the stay being searched, not an abandoned draft.
    const toggle = () => {
        if (!open) {
            setDraft(stay);
            const d = parse(stay.checkIn);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        }
        setOpen(o => !o);
    };

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
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
                <span className="hidden whitespace-nowrap lg:inline">{label}</span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.12 }}
                        role="dialog"
                        aria-label={tAll('property.rooms.changeDates')}
                        className="absolute right-0 z-50 w-[min(320px,calc(100vw-32px))] md:left-0 md:right-auto"
                        style={{ top: '100%', marginTop: 8, padding: 16, borderRadius: 18, background: p.menu, border: `1px solid ${p.border}`, boxShadow: p.shadow, color: p.text }}
                    >
                        <RangeCalendar
                            tone={tone}
                            month={month}
                            onMonth={setMonth}
                            start={draft.checkIn}
                            end={draft.checkOut}
                            onPick={pickDay}
                        />

                        {/* Guests */}
                        <div className="mt-3 flex flex-col gap-2.5 pt-3" style={{ borderTop: `1px solid ${p.border}` }}>
                            {counters.map(c => (
                                <div key={c.key} className="flex items-center justify-between">
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            aria-label={`Remove ${c.label}`}
                                            disabled={draft[c.key] <= c.min}
                                            onClick={() => setDraft(d => ({ ...d, [c.key]: d[c.key] - 1 }))}
                                            className="flex h-7 w-7 items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30"
                                            style={{ border: `1px solid ${p.border}` }}>
                                            <Minus size={13} />
                                        </button>
                                        <span className="w-5 text-center" style={{ fontSize: 14, fontWeight: 700 }}>{draft[c.key]}</span>
                                        <button
                                            type="button"
                                            aria-label={`Add ${c.label}`}
                                            disabled={draft[c.key] >= c.max}
                                            onClick={() => setDraft(d => ({ ...d, [c.key]: d[c.key] + 1 }))}
                                            className="flex h-7 w-7 items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30"
                                            style={{ border: `1px solid ${p.border}` }}>
                                            <Plus size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={done}
                            disabled={!draft.checkOut}
                            className="mt-4 h-10 w-full rounded-full cursor-pointer disabled:cursor-default disabled:opacity-50"
                            style={{ background: ACCENT, color: '#FFFFFF', fontSize: 14, fontWeight: 700, border: 'none' }}>
                            {t('done')}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
