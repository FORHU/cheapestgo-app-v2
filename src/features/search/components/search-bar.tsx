'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search } from 'lucide-react';
import { useMapboxSearch } from '@/shared/components/mapbox/hooks/useMapboxSearch';
import { sortPalette } from './search-chrome';

/**
 * Four states, per the design:
 *
 *   inactive  — 'Where to next? Try "Phuket Town"...'   nothing searched yet
 *   selected  — empty field, caret, suggestions          focused
 *   searching — "Searching..."                           a search is in flight
 *   searched  — "Gangnam District | …"                   the current search
 *
 * Every state but `selected` renders muted text, so those three drive the
 * placeholder and leave the value empty. Focus deliberately clears the summary
 * rather than seeding the field with it: the design's selected state is an
 * empty bar, and typing over a long summary is worse anyway.
 *
 * Suggestions come from the same debounced Mapbox geocoder the map overlay
 * uses, so picking one carries real coordinates through to the search rather
 * than a bare string the API has to re-resolve.
 */
export function SearchBar({
    summary, searching, theme, proximity, onSubmit,
}: {
    summary: string; searching: boolean; theme: 'light' | 'dark';
    proximity?: { lat: number; lng: number };
    onSubmit: (name: string, coords?: { lat: number; lng: number }) => void;
}) {
    const [focused, setFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dark = theme === 'dark';
    const p = sortPalette(theme);
    const muted = dark ? 'rgba(245,245,245,0.55)' : 'rgba(17,17,17,0.45)';
    /** Ties the input to its suggestion list for screen readers. Generated, not
     *  a constant: the id has to be unique if two bars ever share a page. */
    const listboxId = useId();

    const {
        originQuery, originResults, showOriginResults,
        isSearching: suggesting, handleOriginSearch, clearSearch,
    } = useMapboxSearch({ proximity });

    const state = focused ? 'selected' : searching ? 'searching' : summary ? 'searched' : 'inactive';
    const placeholder =
        state === 'searching' ? 'Searching...' :
        state === 'searched'  ? summary :
        state === 'inactive'  ? 'Where to next? Try "Phuket Town"...' : '';

    const suggestions = focused && showOriginResults ? originResults : [];

    const close = useCallback(() => {
        setFocused(false);
        setActiveIndex(-1);
        clearSearch();
    }, [clearSearch]);

    // Click-away closes the panel. Focus alone is not enough: picking a
    // suggestion uses mousedown, which fires before blur.
    useEffect(() => {
        if (!focused) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [focused, close]);

    const submit = (name: string, coords?: { lat: number; lng: number }) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        inputRef.current?.blur();
        close();
        onSubmit(trimmed, coords);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { inputRef.current?.blur(); close(); return; }
        if (!suggestions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => (i + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i <= 0 ? suggestions.length : i) - 1);
        }
    };

    return (
        // Grows into the toolbar's free space but stops short of hogging it —
        // the design keeps the controls that follow close to the field.
        <div ref={wrapRef} className="relative min-w-0" style={{ flex: '1 1 auto', maxWidth: 470 }}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
                    if (picked) submit(picked.name, { lat: picked.lat, lng: picked.lng });
                    else submit(originQuery);
                }}
                // Shorter and smaller-typed on a phone than on the desktop bar it
                // shares a component with. The field used to be the taller of the
                // two — 44px against 40px — which put the single widest control on
                // the screen where there is least room for it.
                className="flex h-9 items-center gap-2 rounded-full px-3.5 md:h-10 md:gap-3 md:px-[18px]"
                style={{
                    background: p.field,
                    border: `1px solid ${p.border}`,
                    boxShadow: focused
                        ? `0 0 0 2px ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.14)'}`
                        : 'none',
                    transition: 'box-shadow .15s',
                }}
            >
                <Search size={14} className="md:size-4" style={{ color: muted, flexShrink: 0 }} />
                <input
                    ref={inputRef}
                    value={focused ? originQuery : ''}
                    onChange={(e) => { handleOriginSearch(e.target.value); setActiveIndex(-1); }}
                    onFocus={() => setFocused(true)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    aria-label="Search for hotels"
                    aria-expanded={suggestions.length > 0}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    role="combobox"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[12px] md:text-[14px]"
                    style={{ color: p.text, caretColor: p.text }}
                />
                {focused && suggesting && (
                    <span className="animate-spin shrink-0" style={{
                        width: 13, height: 13, borderRadius: '50%',
                        border: `1.5px solid ${p.border}`, borderTopColor: p.text,
                    }} />
                )}
            </form>

            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.ul
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.12 }}
                        role="listbox"
                        id={listboxId}
                        className="absolute left-0 right-0 z-50 overflow-hidden"
                        style={{
                            top: '100%', marginTop: 8, borderRadius: 18,
                            background: p.menu, border: `1px solid ${p.border}`,
                            boxShadow: p.shadow,
                        }}
                    >
                        {suggestions.map((r, i) => (
                            <li key={r.id} role="option" aria-selected={i === activeIndex}>
                                <button
                                    type="button"
                                    // mousedown, not click: the input's blur would
                                    // otherwise tear the list down first.
                                    onMouseDown={(e) => { e.preventDefault(); submit(r.name, { lat: r.lat, lng: r.lng }); }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    className="flex w-full items-center gap-3 text-left"
                                    style={{
                                        padding: '11px 18px', fontSize: 13,
                                        color: p.text,
                                        opacity: i === activeIndex ? 1 : 0.75,
                                        background: i === activeIndex ? p.hover : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <MapPin size={14} style={{ color: muted, flexShrink: 0 }} />
                                    <span className="truncate">{r.name}</span>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
