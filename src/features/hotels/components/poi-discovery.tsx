"use client";

import React, { useRef, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Star, MapPin } from 'lucide-react';
import { POI_FILTERS, type PoiCategory } from '@/shared/config/map-discovery';
import { useNearbyGems, categoryToBg } from '@/features/hotels/hooks/useNearbyGems';

const DISTANCE_OPTIONS = [
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
] as const;

interface PoiDiscoveryProps {
    coordinates: { lat: number; lng: number };
}

export function PoiDiscovery({ coordinates }: PoiDiscoveryProps) {
    const [category, setCategory]       = useState<PoiCategory>('all');
    const [radius, setRadius]           = useState(2000);
    const [dropdownOpen, setDropdown]   = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { gems, loading } = useNearbyGems({ coordinates, category, radiusMeters: radius });

    const scroll = useCallback((dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    }, []);

    const selectedFilter = POI_FILTERS.find(f => f.id === category) ?? POI_FILTERS[0];

    if (!coordinates.lat || !coordinates.lng) return null;

    return (
        <section className="py-4 lg:py-6">
            <h2 className="text-[14px] lg:text-xl font-bold text-slate-900 dark:text-white mb-3 lg:mb-4">
                Nearby places
            </h2>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
                {/* Category dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setDropdown(d => !d)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white shadow-sm hover:border-blue-400 transition-all text-xs font-bold"
                    >
                        {React.createElement(selectedFilter.icon, { size: 13, className: 'text-blue-500' })}
                        <span className="uppercase tracking-wide">{selectedFilter.id === 'all' ? 'All' : selectedFilter.id}</span>
                        <ChevronRight size={12} className={`text-slate-400 transition-transform ${dropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>

                    {dropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setDropdown(false)} />
                            <div className="absolute top-full left-0 mt-1.5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                                {POI_FILTERS.map(f => {
                                    const Icon = f.icon;
                                    const active = category === f.id;
                                    return (
                                        <button
                                            key={f.id}
                                            onClick={() => { setCategory(f.id); setDropdown(false); }}
                                            className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            <Icon size={13} className={active ? 'text-white' : 'text-slate-400'} />
                                            <span className="capitalize">{f.id === 'all' ? 'All' : f.id}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Distance picker */}
                <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full h-7 px-2 shadow-sm">
                    <MapPin size={10} className="text-blue-500 mr-0.5 shrink-0" />
                    {DISTANCE_OPTIONS.map(({ label, value }) => (
                        <button
                            key={value}
                            onClick={() => setRadius(value)}
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                radius === value
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Card strip */}
            <div className="relative group">
                {gems.length > 3 && (
                    <button
                        onClick={() => scroll('left')}
                        className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 -ml-3 w-7 h-7 items-center justify-center bg-white dark:bg-slate-900 rounded-full shadow border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronLeft size={14} />
                    </button>
                )}

                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth pb-1"
                >
                    {loading && gems.length === 0
                        ? Array(8).fill(0).map((_, i) => (
                            <div key={i} className="shrink-0 w-36 h-24 sm:w-44 sm:h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        ))
                        : gems.map((gem, idx) => {
                            const Icon = gem.icon;
                            const bg   = categoryToBg(gem.category);
                            const ratingStr = gem.rating !== null && Number.isFinite(Number(gem.rating)) && Number(gem.rating) > 0
                                ? Number(gem.rating).toFixed(1)
                                : null;

                            return (
                                <div
                                    key={`${gem.id}-${idx}`}
                                    className={`group/card relative shrink-0 w-36 h-24 sm:w-44 sm:h-28 rounded-2xl overflow-hidden cursor-default bg-linear-to-br ${bg} shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300`}
                                >
                                    {/* Photo */}
                                    <img
                                        src={gem.imageUrl}
                                        alt={gem.name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        loading="lazy"
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />

                                    {/* Background icon when no photo */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <Icon size={32} className="text-white/20" />
                                    </div>

                                    {/* Rating badge */}
                                    {ratingStr && (
                                        <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-white/95 dark:bg-slate-900/90 rounded-full px-1.5 py-0.5 shadow-sm">
                                            <Star size={8} className="text-blue-500 fill-blue-500" />
                                            <span className="text-[9px] font-extrabold text-slate-800 dark:text-white">{ratingStr}</span>
                                        </div>
                                    )}

                                    {/* Name + category */}
                                    <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5">
                                        <div className="flex items-center gap-0.5 mb-0.5 opacity-70">
                                            <Icon size={8} className="text-white shrink-0" />
                                            <span className="text-[7px] font-bold uppercase tracking-widest text-white truncate">
                                                {gem.displayCategory ?? gem.category}
                                            </span>
                                        </div>
                                        <h4 className="text-[10px] sm:text-xs font-black leading-tight line-clamp-2 text-white drop-shadow">
                                            {gem.name}
                                        </h4>
                                    </div>
                                </div>
                            );
                        })
                    }

                    {!loading && gems.length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 py-4">
                            No places found nearby.
                        </p>
                    )}
                </div>

                {gems.length > 3 && (
                    <button
                        onClick={() => scroll('right')}
                        className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 -mr-3 w-7 h-7 items-center justify-center bg-white dark:bg-slate-900 rounded-full shadow border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </section>
    );
}
