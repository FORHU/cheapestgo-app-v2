'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin } from 'lucide-react';
import { useMapboxSearch } from '@/shared/components/mapbox/hooks/useMapboxSearch';
import { sortPalette } from '@/features/search/components/sort-pill';

interface SearchBarProps {
    summary: string;
    searching: boolean;
    theme: 'light' | 'dark';
    proximity?: { lat: number; lng: number };
    onSubmit: (name: string, coords?: { lat: number; lng: number }) => void;
}

export function SearchBar({ summary, searching, theme, proximity, onSubmit }: SearchBarProps) {
    const [focused, setFocused]     = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapRef  = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dark = theme === 'dark';
    const p = sortPalette(theme);
    const muted = dark ? 'rgba(245,245,245,0.55)' : 'rgba(17,17,17,0.45)';

    const { originQuery, originResults, showOriginResults, setShowOriginResults, isSearching: suggesting, handleOriginSearch, clearSearch } = useMapboxSearch({ proximity });

    const state =
        focused    ? 'selected'  :
        searching  ? 'searching' :
        summary    ? 'searched'  : 'inactive';

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
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggestions.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i <= 0 ? suggestions.length : i) - 1); }
    };

    return (
        <div ref={wrapRef} className="relative min-w-0" style={{ flex: '1 1 auto', maxWidth: 470 }}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
                    if (picked) submit(picked.name, { lat: picked.lat, lng: picked.lng });
                    else submit(originQuery);
                }}
                className="flex items-center gap-3 rounded-full"
                style={{ height: 40, padding: '0 18px', background: p.field, border: `1px solid ${p.border}`, boxShadow: focused ? `0 0 0 2px ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.14)'}` : 'none', transition: 'box-shadow .15s' }}
            >
                <Search size={16} style={{ color: muted, flexShrink: 0 }} />
                <input
                    ref={inputRef}
                    value={focused ? originQuery : ''}
                    onChange={(e) => { handleOriginSearch(e.target.value); setActiveIndex(-1); }}
                    onFocus={() => setFocused(true)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    aria-label="Search for hotels"
                    aria-expanded={suggestions.length > 0}
                    aria-autocomplete="list"
                    role="combobox"
                    className="flex-1 min-w-0 bg-transparent outline-none"
                    style={{ fontSize: 14, color: p.text, caretColor: p.text }}
                />
                {focused && suggesting && (
                    <span className="animate-spin shrink-0" style={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid ${p.border}`, borderTopColor: p.text }} />
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
                        className="absolute left-0 right-0 z-50 overflow-hidden"
                        style={{ top: '100%', marginTop: 8, borderRadius: 18, background: p.menu, border: `1px solid ${p.border}`, boxShadow: p.shadow }}
                    >
                        {suggestions.map((r, i) => (
                            <li key={r.id} role="option" aria-selected={i === activeIndex}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); submit(r.name, { lat: r.lat, lng: r.lng }); }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    className="flex w-full items-center gap-3 text-left"
                                    style={{ padding: '11px 18px', fontSize: 13, color: p.text, opacity: i === activeIndex ? 1 : 0.75, background: i === activeIndex ? p.hover : 'transparent', cursor: 'pointer' }}
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
