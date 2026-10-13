'use client';

import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, PlaneTakeoff } from 'lucide-react';
import { sortPalette } from '@/features/search/components/search-chrome';
import { autocompleteDestinations, type DestinationSuggestion } from '@/features/search/api/destinations.api';
import { POPULAR_AIRPORTS } from '@/features/search/lib/popular-airports';

type Side = 'origin' | 'destination';

/** "CRK" out of "Clark (CRK)", or a bare code as it stands — what the phone bar has room for. */
function shortLabel(place: string): string {
    const tagged = /\(([A-Z]{3})\)/.exec(place);
    return tagged ? tagged[1] : place;
}

/**
 * The route on the flight results bar — the hotel bar's search field, as two
 * airports either side of a swap.
 *
 * Each end is its own field. At rest it shows the airport being searched
 * ("Clark (CRK)", or just "CRK" on a phone); focused it empties for typing and
 * offers the popular airports until two letters are in, then the airport index.
 * Picking one re-runs the search at once, as picking a place does on the hotel
 * bar — there is no half-changed route to hold.
 */
export function RouteEditor({
    tone, origin, destination, searching, onApply,
}: {
    tone: 'light' | 'dark';
    /** As the URL carries them — "Clark (CRK)", or a bare code from a deep link. */
    origin: string;
    destination: string;
    searching: boolean;
    onApply: (next: { origin: string; destination: string }) => void;
}) {
    const t = useTranslations('landing.search');
    const tAll = useTranslations();
    const p = sortPalette(tone);
    const dark = tone === 'dark';
    const muted = dark ? 'rgba(245,245,245,0.55)' : 'rgba(17,17,17,0.45)';
    const listboxId = useId();

    const [side, setSide] = useState<Side | null>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DestinationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputs = { origin: useRef<HTMLInputElement>(null), destination: useRef<HTMLInputElement>(null) };

    const typed = query.trim().length >= 2;
    const suggestions = side ? (typed ? results : POPULAR_AIRPORTS) : [];

    // Debounced, and stale answers dropped: a slow reply for "ma" must not land
    // over the one for "man".
    useEffect(() => {
        if (!typed) { setResults([]); setLoading(false); return; }
        let live = true;
        setLoading(true);
        const id = setTimeout(async () => {
            const found = await autocompleteDestinations(query, 'flights');
            if (live) { setResults(found); setLoading(false); setActiveIndex(-1); }
        }, 200);
        return () => { live = false; clearTimeout(id); };
    }, [query, typed]);

    const close = useCallback(() => {
        setSide(null);
        setQuery('');
        setActiveIndex(-1);
    }, []);

    // Click-away closes the list. Picking uses mousedown, which fires before blur.
    useEffect(() => {
        if (!side) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [side, close]);

    const pick = (s: DestinationSuggestion) => {
        if (!side) return;
        inputs[side].current?.blur();
        const next = side === 'origin' ? { origin: s.title, destination } : { origin, destination: s.title };
        close();
        if (next.origin !== origin || next.destination !== destination) onApply(next);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { if (side) inputs[side].current?.blur(); close(); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            const chosen = suggestions[activeIndex >= 0 ? activeIndex : 0];
            if (chosen && (typed || activeIndex >= 0)) pick(chosen);
            return;
        }
        if (!suggestions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length : i) - 1);
        }
    };

    const field = (which: Side) => {
        const value = which === 'origin' ? origin : destination;
        const focused = side === which;
        return (
            <div className="relative min-w-0 flex-1">
                <input
                    ref={inputs[which]}
                    value={focused ? query : ''}
                    onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
                    onFocus={() => { setSide(which); setQuery(''); setActiveIndex(-1); }}
                    onKeyDown={onKeyDown}
                    placeholder={focused ? t('placeholder.airport') : ''}
                    aria-label={which === 'origin' ? t('from') : t('to')}
                    aria-expanded={focused && suggestions.length > 0}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    role="combobox"
                    className="w-full min-w-0 bg-transparent text-[12px] outline-none md:text-[14px]"
                    style={{ color: p.text, caretColor: p.text }}
                />
                {/* The airport at rest, drawn over the empty field rather than as
                    its value — focusing clears it for typing, as the hotel bar's
                    field does, and the phone gets the code alone. */}
                {!focused && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-center truncate text-[12px] font-semibold md:text-[14px]"
                        style={{ color: p.text }}
                    >
                        <span className="truncate md:hidden">{shortLabel(value)}</span>
                        <span className="hidden truncate md:inline">{value}</span>
                    </span>
                )}
            </div>
        );
    };

    return (
        <div ref={wrapRef} className="relative min-w-0" style={{ flex: '1 1 auto', maxWidth: 520 }}>
            <div
                className="flex h-9 items-center gap-1.5 rounded-full px-2.5 md:h-10 md:gap-3 md:px-[18px]"
                style={{
                    background: p.field,
                    border: `1px solid ${p.border}`,
                    boxShadow: side ? `0 0 0 2px ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.14)'}` : 'none',
                    transition: 'box-shadow .15s',
                }}
            >
                <PlaneTakeoff size={16} className="hidden shrink-0 md:block" style={{ color: muted }} />
                {field('origin')}
                <button
                    type="button"
                    onClick={() => onApply({ origin: destination, destination: origin })}
                    aria-label={tAll('flights.topBar.swap')}
                    title={tAll('flights.topBar.swap')}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-70 md:h-7 md:w-7"
                    style={{ background: p.hover, color: p.text }}
                >
                    <ArrowLeftRight size={12} className="md:size-[13px]" />
                </button>
                {field('destination')}
                {(searching || (side && loading)) && (
                    <span className="shrink-0 animate-spin" style={{
                        width: 13, height: 13, borderRadius: '50%',
                        border: `1.5px solid ${p.border}`, borderTopColor: p.text,
                    }} />
                )}
            </div>

            <AnimatePresence>
                {side && (
                    <motion.ul
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.12 }}
                        role="listbox"
                        id={listboxId}
                        className="absolute left-0 z-50 w-full min-w-[280px] overflow-hidden py-1.5"
                        style={{
                            top: '100%', marginTop: 8, borderRadius: 18,
                            background: p.menu, border: `1px solid ${p.border}`, boxShadow: p.shadow,
                        }}
                    >
                        {!typed && (
                            <li className="px-[18px] pt-1.5 pb-1 text-[11px] tracking-[0.13em] uppercase" style={{ color: muted }}>
                                {tAll('search.popularAirports')}
                            </li>
                        )}
                        {typed && !loading && suggestions.length === 0 && (
                            <li className="px-[18px] py-3 text-[13px]" style={{ color: muted }}>
                                {tAll('search.noAirportsMatch', { query: query.trim() })}
                            </li>
                        )}
                        {suggestions.map((s, i) => (
                            <li key={`${s.code}-${i}`} role="option" aria-selected={i === activeIndex}>
                                <button
                                    type="button"
                                    // mousedown, not click: the input's blur would
                                    // otherwise tear the list down first.
                                    onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    className="flex w-full items-center gap-3 text-left cursor-pointer"
                                    style={{
                                        padding: '9px 18px', color: p.text,
                                        background: i === activeIndex ? p.hover : 'transparent',
                                    }}
                                >
                                    <span
                                        className="flex h-7 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-wide"
                                        style={{ background: p.hover }}
                                    >
                                        {s.code}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13px] font-semibold">{s.title}</span>
                                        <span className="block truncate text-[11px]" style={{ color: muted }}>{s.subtitle}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
