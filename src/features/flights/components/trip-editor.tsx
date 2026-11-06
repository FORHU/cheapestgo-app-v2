'use client';

import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Minus, Plus } from 'lucide-react';
import { ACCENT, sortPalette } from '@/features/search/components/search-chrome';
import { RangeCalendar, parseDay } from '@/features/search/components/range-calendar';
import { BarSheet, opensAsSheet } from '@/features/search/components/bar-sheet';

export interface Trip {
    departure: string;      // YYYY-MM-DD
    /** Absent for a one-way trip. */
    returnDate?: string;
    adults: number;
    children: number;
    infants: number;
    /** `economy`, `premium_economy`, `business`, `first` — as the URL carries it. */
    cabin: string;
}

const CABINS = ['economy', 'premium_economy', 'business', 'first'] as const;

/** `premium_economy` in the URL, `premiumEconomy` in the locale file. */
const cabinKey = (cabin: string) => cabin.replace(/_(.)/g, (_, c: string) => c.toUpperCase());

/**
 * The trip on the flight results bar — dates, travellers and cabin — as the hotel
 * bar's stay editor is for a stay: a control rather than text, so changing a date
 * no longer means starting the search over from the landing page.
 *
 * Edits are drafted in the panel and reach the search only on "Done", so stepping
 * through the calendar does not fire a search per click. A round trip without its
 * return date cannot be applied: half a round trip is not a search.
 *
 * From `md` up the panel hangs under the button. On a phone it is a sheet along the
 * bottom of the screen (`BarSheet`), as the stay editor's is: the popover ran down
 * under the bottom nav there, which hid its Done button.
 */
export function TripEditor({ tone, onApply, ...trip }: Trip & {
    tone: 'light' | 'dark';
    onApply: (next: Trip) => void;
}) {
    const t = useTranslations('landing.search');
    const tAll = useTranslations();
    const locale = useLocale();
    const p = sortPalette(tone);

    const [open, setOpen] = useState(false);
    /** Whether this opening is a sheet (a phone) rather than the popover. */
    const [sheet, setSheet] = useState(false);
    const [draft, setDraft] = useState<Trip>(trip);
    const [roundTrip, setRoundTrip] = useState(!!trip.returnDate);
    const firstOf = (day: string) => { const d = parseDay(day); return new Date(d.getFullYear(), d.getMonth(), 1); };
    const [month, setMonth] = useState(() => firstOf(trip.departure));
    const wrapRef = useRef<HTMLDivElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Each opening starts from the trip being searched, not an abandoned draft.
    const toggle = () => {
        if (!open) {
            setDraft(trip);
            setRoundTrip(!!trip.returnDate);
            setMonth(firstOf(trip.departure));
            setSheet(opensAsSheet());
        }
        setOpen((o) => !o);
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

    const fmtShort = (s: string) => parseDay(s).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const travellers = [
        tAll('flights.passengers.adults', { count: trip.adults }),
        trip.children > 0 && tAll('flights.passengers.children', { count: trip.children }),
        trip.infants > 0 && tAll('flights.passengers.infants', { count: trip.infants }),
    ].filter(Boolean).join(', ');
    const dates = trip.returnDate ? `${fmtShort(trip.departure)} – ${fmtShort(trip.returnDate)}` : fmtShort(trip.departure);
    const label = `${dates} · ${travellers} · ${t(`cabinClass.${cabinKey(trip.cabin)}`)}`;

    // One way: any click is the departure. Round trip: a first click, or one on or
    // before the departure, starts over; a later one is the return.
    const pickDay = (day: string) => setDraft((d) =>
        roundTrip && d.departure && !d.returnDate && day > d.departure
            ? { ...d, returnDate: day }
            : { ...d, departure: day, returnDate: roundTrip ? '' : undefined });

    const setTripType = (round: boolean) => {
        setRoundTrip(round);
        setDraft((d) => ({ ...d, returnDate: round ? d.returnDate ?? '' : undefined }));
    };

    const ready = !!draft.departure && (!roundTrip || !!draft.returnDate);
    const done = () => {
        if (!ready) return;
        setOpen(false);
        onApply({ ...draft, returnDate: roundTrip ? draft.returnDate : undefined });
    };

    // An infant flies on an adult's lap, so there can be no more of them than adults.
    const counters: { key: 'adults' | 'children' | 'infants'; label: string; min: number; max: number }[] = [
        { key: 'adults',   label: t('adults'),   min: 1, max: 9 - draft.children },
        { key: 'children', label: t('children'), min: 0, max: 9 - draft.adults },
        { key: 'infants',  label: t('infants'),  min: 0, max: draft.adults },
    ];

    const chip = (on: boolean): React.CSSProperties => ({
        background: on ? ACCENT : 'transparent',
        color: on ? '#FFFFFF' : p.text,
        border: `1px solid ${on ? 'transparent' : p.border}`,
        fontSize: sheet ? 14 : 12, fontWeight: 600,
    });

    // The same editor in the popover and the sheet; the sheet's controls are sized for a thumb —
    // 44px days, steppers and chips, a 48px Done — where the popover's are a mouse's.
    const step = sheet ? 'h-11 w-11' : 'h-7 w-7';
    const chipH = sheet ? 'h-11' : 'h-8';
    const editor = (
        <>
            {/* One way / round trip */}
            <div className="mb-3 grid grid-cols-2 gap-1.5">
                <button type="button" aria-pressed={!roundTrip} onClick={() => setTripType(false)}
                    className={`${chipH} rounded-full cursor-pointer`} style={chip(!roundTrip)}>
                    {t('tripType.oneWay')}
                </button>
                <button type="button" aria-pressed={roundTrip} onClick={() => setTripType(true)}
                    className={`${chipH} rounded-full cursor-pointer`} style={chip(roundTrip)}>
                    {t('tripType.roundTrip')}
                </button>
            </div>

            <RangeCalendar
                tone={tone}
                month={month}
                onMonth={setMonth}
                start={draft.departure}
                end={draft.returnDate ?? ''}
                onPick={pickDay}
                roomy={sheet}
            />

            {/* Travellers */}
            <div className={`flex flex-col pt-3 ${sheet ? 'mt-4 gap-1.5' : 'mt-3 gap-2.5'}`} style={{ borderTop: `1px solid ${p.border}` }}>
                {counters.map((c) => (
                    <div key={c.key} className="flex items-center justify-between">
                        <span style={{ fontSize: sheet ? 15 : 13, fontWeight: 600 }}>{c.label}</span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                aria-label={`Remove ${c.label}`}
                                disabled={draft[c.key] <= c.min}
                                onClick={() => setDraft((d) => {
                                    const next = { ...d, [c.key]: d[c.key] - 1 };
                                    // Fewer adults can leave more infants than laps.
                                    return { ...next, infants: Math.min(next.infants, next.adults) };
                                })}
                                className={`flex ${step} items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30`}
                                style={{ border: `1px solid ${p.border}` }}>
                                <Minus size={sheet ? 16 : 13} />
                            </button>
                            <span className="w-5 text-center" style={{ fontSize: sheet ? 16 : 14, fontWeight: 700 }}>{draft[c.key]}</span>
                            <button
                                type="button"
                                aria-label={`Add ${c.label}`}
                                disabled={draft[c.key] >= c.max}
                                onClick={() => setDraft((d) => ({ ...d, [c.key]: d[c.key] + 1 }))}
                                className={`flex ${step} items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30`}
                                style={{ border: `1px solid ${p.border}` }}>
                                <Plus size={sheet ? 16 : 13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Cabin */}
            <div className={`pt-3 ${sheet ? 'mt-4' : 'mt-3'}`} style={{ borderTop: `1px solid ${p.border}` }}>
                <span className="mb-2 block" style={{ fontSize: sheet ? 15 : 13, fontWeight: 600 }}>{tAll('flights.topBar.cabin')}</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {CABINS.map((c) => (
                        <button key={c} type="button" aria-pressed={draft.cabin === c}
                            onClick={() => setDraft((d) => ({ ...d, cabin: c }))}
                            className={`${chipH} rounded-full px-2 cursor-pointer`} style={chip(draft.cabin === c)}>
                            {t(`cabinClass.${cabinKey(c)}`)}
                        </button>
                    ))}
                </div>
            </div>

        </>
    );
    // In the popover Done ends the panel; in the sheet it is the pinned footer.
    const doneButton = (
        <button
            type="button"
            onClick={done}
            disabled={!ready}
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
                title={tAll('flights.topBar.changeTrip')}
                className="flex h-9 items-center gap-2 rounded-full px-2.5 cursor-pointer transition-opacity hover:opacity-80 md:h-10 md:px-4"
                style={{ background: p.field, border: `1px solid ${p.border}`, color: p.text, fontSize: 13, fontWeight: 600 }}
            >
                <CalendarDays size={15} className="shrink-0" />
                <span className="hidden whitespace-nowrap lg:inline">{label}</span>
            </button>

            {sheet ? (
                <BarSheet open={open} title={tAll('flights.topBar.changeTrip')} tone={tone} onClose={() => setOpen(false)} sheetRef={sheetRef} footer={doneButton}>
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
                            aria-label={tAll('flights.topBar.changeTrip')}
                            // Below `lg` the button ends the route's row at the bar's right edge, so
                            // the panel opens leftwards from it; from `lg` the bar is one row and the
                            // button sits mid-bar, so it opens rightwards. Either way it stays on
                            // the screen — at 768px a left-anchored panel ran 188px off the right.
                            className="absolute right-0 z-50 max-h-[calc(100dvh-96px)] w-[340px] overflow-y-auto lg:right-auto lg:left-0"
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
