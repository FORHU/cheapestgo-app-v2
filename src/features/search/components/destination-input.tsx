'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, History, Plane, Building2, Globe, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import type { Destination } from '@/shared/types';
import {
    useSearchStore,
    useDestinationQuery,
    useRecentSearches,
    useActiveDropdown,
} from '@/shared/stores/search.store';

type DropdownField = 'origin' | 'destination';

interface DestinationInputProps {
    forceOpen?: boolean;
    onSelect?: (d: Destination) => void;
    placeholder?: string;
    segmentIndex?: number;
    field?: DropdownField;
}

function getDropdownKey(segmentIndex?: number, field?: DropdownField): string {
    if (segmentIndex !== undefined && field) return `flight-${field}`;
    return 'destination';
}

function getIcon(type: Destination['type']) {
    switch (type) {
        case 'history':  return <History size={16} />;
        case 'airport':  return <Plane size={16} />;
        case 'country':  return <Globe size={16} />;
        default:         return <Building2 size={16} />;
    }
}

export function DestinationInput({ forceOpen, onSelect, segmentIndex, field }: DestinationInputProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [localQuery, setLocalQuery] = useState('');

    const query = useDestinationQuery();
    const recentSearches = useRecentSearches();
    const activeDropdown = useActiveDropdown();
    const { setDestination, setDestinationQuery, addRecentSearch, setActiveDropdown, removeRecentSearch, setFlightSegment } =
        useSearchStore();

    const dropdownKey = getDropdownKey(segmentIndex, field);
    const isFlightField = segmentIndex !== undefined && field !== undefined;
    const activeQuery = isFlightField ? localQuery : query;

    const [debouncedQuery, setDebouncedQuery] = useState(activeQuery);
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(activeQuery), 350);
        return () => clearTimeout(t);
    }, [activeQuery]);

    const { data: suggestions = [], isFetching } = useQuery<Destination[]>({
        queryKey: ['autocomplete', isFlightField ? 'flights' : 'destinations', debouncedQuery],
        queryFn: () => {
            const mode = isFlightField ? 'flights' : 'hotels';
            return fetch(`/api/autocomplete?query=${encodeURIComponent(debouncedQuery)}&mode=${mode}`)
                .then(r => r.json())
                .then((res: { success: boolean; data: Destination[] }) => res.success ? res.data : []);
        },
        enabled: debouncedQuery.length >= 2,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const isOpen = forceOpen || activeDropdown === dropdownKey;

    useEffect(() => {
        if (isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                if (!forceOpen) setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, forceOpen, setActiveDropdown]);

    const handleSelect = (d: Destination) => {
        if (isFlightField) {
            setFlightSegment(segmentIndex!, { [field!]: d });
            setLocalQuery('');
        } else {
            setDestination(d);
            setDestinationQuery(d.title);
            addRecentSearch(d);
        }
        onSelect?.(d);
        if (!forceOpen) setActiveDropdown(null);
    };

    const handleQueryChange = (val: string) => {
        if (isFlightField) setLocalQuery(val);
        else setDestinationQuery(val);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className={
                        forceOpen
                            ? 'w-full z-10'
                            : 'absolute top-full left-0 mt-3 w-[480px] min-w-[480px] max-w-[480px] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-100'
                    }
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Search input inside the dropdown */}
                    <div className="p-4 border-b border-slate-100 dark:border-white/5">
                        <span className="text-[9px] text-slate-500 font-mono font-medium uppercase tracking-wider block mb-1">
                            Where to?
                        </span>
                        <div className="flex items-center gap-2">
                            <MapPin className="text-slate-400 shrink-0" size={18} />
                            <input
                                autoFocus
                                type="text"
                                value={activeQuery}
                                onChange={(e) => handleQueryChange(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="Search destinations..."
                                className="bg-transparent border-none p-0 text-[13px] font-bold focus:ring-0 outline-none w-full text-slate-900 dark:text-white placeholder:font-normal placeholder:text-slate-400"
                            />
                            {isFetching && (
                                <div className="relative h-4 w-4 shrink-0">
                                    <div className="absolute inset-0 border-2 border-slate-200 dark:border-white/10 rounded-full" />
                                    <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                            {activeQuery && (
                                <button
                                    onClick={() => handleQueryChange('')}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full"
                                >
                                    <X size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-[260px] overflow-y-auto py-2">
                        {/* Recent searches */}
                        {!query && recentSearches.length > 0 && (
                            <>
                                <div className="px-6 py-1.5 text-[8px] font-mono font-medium uppercase text-slate-500 tracking-wider">
                                    Recent
                                </div>
                                {recentSearches.map((item, i) => (
                                    <div
                                        key={i}
                                        onClick={() => handleSelect(item)}
                                        className="px-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-400 group-hover:text-amber-500">
                                                <History size={14} />
                                            </span>
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-900 dark:text-white group-hover:text-amber-500">
                                                    {item.title}
                                                </p>
                                                <p className="text-[10px] text-slate-400">{item.subtitle}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeRecentSearch(item.title); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-all"
                                        >
                                            <X size={12} className="text-slate-400" />
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Autocomplete results */}
                        {activeQuery && suggestions.length === 0 && !isFetching && (
                            <div className="px-6 py-4 text-center text-slate-400 text-sm">
                                No results found
                            </div>
                        )}
                        {activeQuery && suggestions.length > 0 && (() => {
                            const countries = suggestions.filter((s) => s.type === 'country');
                            const cities = suggestions.filter((s) => s.type !== 'country');
                            const renderItem = (item: Destination, i: number) => (
                                <div
                                    key={i}
                                    onClick={() => handleSelect(item)}
                                    className="px-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-start gap-3 cursor-pointer group"
                                >
                                    <span className={cn(
                                        'mt-0.5 text-slate-400 transition-colors',
                                        item.type === 'country'
                                            ? 'group-hover:text-emerald-500'
                                            : 'group-hover:text-blue-500'
                                    )}>
                                        {getIcon(item.type)}
                                    </span>
                                    <div className="flex-1">
                                        <p className={cn(
                                            'text-[11px] font-bold text-slate-900 dark:text-white',
                                            item.type === 'country'
                                                ? 'group-hover:text-emerald-500'
                                                : 'group-hover:text-blue-500'
                                        )}>
                                            {item.title}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate max-w-[300px]">
                                            {item.subtitle}
                                        </p>
                                    </div>
                                </div>
                            );
                            return (
                                <>
                                    {countries.length > 0 && (
                                        <>
                                            <div className="px-6 py-1.5 text-[8px] font-mono font-medium uppercase text-slate-500 tracking-wider">Countries</div>
                                            {countries.map(renderItem)}
                                        </>
                                    )}
                                    {cities.length > 0 && (
                                        <>
                                            <div className={cn('px-6 py-1.5 text-[8px] font-mono font-medium uppercase text-slate-500 tracking-wider', countries.length > 0 && 'mt-1')}>Cities</div>
                                            {cities.map(renderItem)}
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
