'use client';

/**
 * MapGemsPanel — POI / nearby-gems discovery panel.
 * POI fetching is stubbed out (useNearbyGems returns []).
 * This component renders an empty state or loading placeholder.
 * Full POI functionality is a separate task.
 */

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Search, Star, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// ─── Stub for POI_FILTERS (POI task will replace this) ───────────────────────
const POI_FILTERS = [
    { id: 'all', icon: Search, label: 'All' },
    { id: 'restaurant', icon: Search, label: 'Restaurants' },
    { id: 'attraction', icon: Search, label: 'Attractions' },
    { id: 'grocery', icon: Search, label: 'Grocery' },
    { id: 'medical', icon: Search, label: 'Medical' },
    { id: 'transit', icon: Search, label: 'Transit' },
];

// ─── Stub for getPoiImageUrl (POI task will replace this) ────────────────────
function getPoiImageUrl(_name: string, _lat: number, _lng: number, _opts?: any): string {
    return '';
}

const DISTANCE_OPTIONS = [
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
    { label: '10 km', value: 10000 },
] as const;

interface MapGemsPanelProps {
    gems: any[];
    isLoading: boolean;
    selectedCategory: string;
    onCategoryChange: (cat: string) => void;
    radiusMeters: number;
    onRadiusChange: (r: number) => void;
    activeGemName: string | null;
    onGemClick: (gem: any) => void;
}

export function MapGemsPanel({
    gems,
    isLoading,
    selectedCategory,
    onCategoryChange,
    radiusMeters,
    onRadiusChange,
    activeGemName,
    onGemClick,
}: MapGemsPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [imageStatus, setImageStatus] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

    const firstGemName = gems[0] ? (gems[0].properties?.name || gems[0].name) : null;
    const prevFirstRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (firstGemName !== prevFirstRef.current) {
            prevFirstRef.current = firstGemName;
            setImageStatus({});
        }
    }, [firstGemName]);

    const scroll = (dir: 'left' | 'right') =>
        scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });

    const currentFilter = POI_FILTERS.find(f => f.id === selectedCategory) ?? POI_FILTERS[0];

    return (
        <div className="flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-200">
            {/* Controls row */}
            <div className="flex items-center gap-2 px-1 flex-wrap">
                {/* Category dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(d => !d)}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white shadow-md hover:border-blue-400 transition-all active:scale-95 cursor-pointer"
                    >
                        {React.createElement(currentFilter.icon, { size: 12, className: 'text-blue-500' })}
                        <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                            {currentFilter.label}
                        </span>
                        <ChevronRight size={12} className={`text-slate-400 transition-transform ${dropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>

                    {dropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                            <div className="absolute bottom-full left-0 mb-2 w-44 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
                                <div className="p-1.5 space-y-0.5">
                                    <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Filter</div>
                                    {POI_FILTERS.map(f => {
                                        const active = selectedCategory === f.id;
                                        const Icon = f.icon;
                                        return (
                                            <button
                                                key={f.id}
                                                onClick={() => { onCategoryChange(f.id); setDropdownOpen(false); }}
                                                className={cn(
                                                    'flex items-center gap-2 w-full px-3 py-2 rounded-xl transition-all cursor-pointer',
                                                    active ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                )}
                                            >
                                                <Icon size={12} className={active ? 'text-white' : 'text-slate-400'} />
                                                <span className="text-[11px] font-semibold">{f.label}</span>
                                                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Distance selector */}
                <div className="flex items-center gap-0.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-full h-7 px-2 shadow-md">
                    <MapPin size={10} className="text-blue-500 mr-0.5 shrink-0" />
                    {DISTANCE_OPTIONS.map(({ label, value }) => (
                        <button
                            key={value}
                            onClick={() => onRadiusChange(value)}
                            className={cn(
                                'px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap',
                                radiusMeters === value ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Count / loading */}
                <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-full h-7 px-2.5 shadow-md">
                    {isLoading ? (
                        <Loader2 size={10} className="text-blue-500 animate-spin" />
                    ) : (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {gems.length} nearby
                        </span>
                    )}
                </div>
            </div>

            {/* Photo card carousel */}
            <div className="relative group/bar">
                {gems.length > 1 && (
                    <button
                        onClick={() => scroll('left')}
                        className="hidden lg:flex absolute left-1 top-1/2 -translate-y-1/2 z-40 w-6 h-6 items-center justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/bar:opacity-100 cursor-pointer"
                    >
                        <ChevronLeft size={12} />
                    </button>
                )}

                <div
                    ref={scrollRef}
                    className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth px-1 py-1"
                >
                    {isLoading && gems.length === 0 && Array(6).fill(0).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-36 h-24 sm:w-44 sm:h-28 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl animate-pulse" />
                    ))}

                    {!isLoading && gems.length === 0 && (
                        <div className="flex items-center justify-center w-full min-w-[200px] h-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-400">No places found in this area</span>
                        </div>
                    )}

                    {gems.map((gem, idx) => {
                        const name = gem.properties?.name || gem.name;
                        const status = imageStatus[name] ?? 'loading';
                        if (status === 'error') return null;

                        const isActive = activeGemName === name;
                        const lng = gem.geometry?.coordinates[0];
                        const lat = gem.geometry?.coordinates[1];
                        const category = gem.properties?.category || gem.category || '';
                        const imageUrl = gem.properties?.imageUrl || getPoiImageUrl(name, lat, lng, { category });
                        const ratingRaw = Number(gem.properties?.rating);
                        const ratingDisplay = Number.isFinite(ratingRaw)
                            ? (Number.isInteger(ratingRaw) ? String(ratingRaw) : ratingRaw.toFixed(1))
                            : null;

                        return (
                            <div
                                key={`${name}-${idx}`}
                                onClick={() => status === 'loaded' && onGemClick(gem)}
                                className={cn(
                                    'group relative flex-shrink-0 rounded-2xl overflow-hidden transition-all duration-300',
                                    'w-36 h-24 sm:w-44 sm:h-28',
                                    status === 'loaded' ? 'cursor-pointer' : 'cursor-default',
                                    isActive ? 'shadow-2xl scale-[1.03] z-10' : 'shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95'
                                )}
                            >
                                {status === 'loading' && (
                                    <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl z-10" />
                                )}

                                {imageUrl && (
                                    <Image
                                        src={imageUrl}
                                        alt={name}
                                        fill
                                        sizes="176px"
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        loading="eager"
                                        onLoad={() => setImageStatus(prev => ({ ...prev, [name]: 'loaded' }))}
                                        onError={() => setImageStatus(prev => ({ ...prev, [name]: 'error' }))}
                                    />
                                )}

                                {status === 'loaded' && (
                                    <>
                                        <div className={cn(
                                            'absolute inset-0 bg-gradient-to-t transition-opacity duration-300',
                                            isActive ? 'from-blue-900/80 via-black/20 to-transparent' : 'from-black/80 via-black/10 to-transparent group-hover:from-black/90'
                                        )} />

                                        {ratingDisplay && (
                                            <div className="absolute top-2 left-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm">
                                                <Star size={9} className="text-blue-500 fill-blue-500" />
                                                <span className="text-[10px] font-extrabold text-slate-800 dark:text-white">{ratingDisplay}</span>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 p-2.5 flex flex-col justify-end text-white">
                                            <h4 className="text-[11px] font-black leading-tight line-clamp-2 drop-shadow-lg">{name}</h4>
                                        </div>

                                        {isActive && (
                                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {gems.length > 1 && (
                    <button
                        onClick={() => scroll('right')}
                        className="hidden lg:flex absolute right-1 top-1/2 -translate-y-1/2 z-40 w-6 h-6 items-center justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/bar:opacity-100 cursor-pointer"
                    >
                        <ChevronRight size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}
