'use client';

import React, { useMemo, useState } from 'react';
import { HotelCard, HotelCardSkeleton, type HotelResult } from './hotel-card';
import { HotelFilters, SortPills, type HotelFiltersState, type SortOption } from './hotel-filters';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: HotelFiltersState = {
    sortBy: 'recommended',
    starRatings: [],
    minPrice: 0,
    maxPrice: Infinity,
};

interface HotelResultsProps {
    hotels: HotelResult[];
    loading: boolean;
    error: string | null;
    destination: string;
    searchQs: string;
}

export function HotelResults({ hotels, loading, error, destination, searchQs }: HotelResultsProps) {
    const [filters, setFilters] = useState<HotelFiltersState>(DEFAULT_FILTERS);
    const [page, setPage] = useState(1);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    const updateFilters = (next: Partial<HotelFiltersState>) => {
        setFilters((f) => ({ ...f, ...next }));
        setPage(1);
    };

    const resetFilters = () => {
        setFilters(DEFAULT_FILTERS);
        setPage(1);
    };

    // Price range derived from results
    const priceRange = useMemo(() => {
        if (hotels.length === 0) return { min: 0, max: 10000 };
        const prices = hotels.map((h) => h.price).filter((p) => p > 0);
        return {
            min: Math.floor(Math.min(...prices)),
            max: Math.ceil(Math.max(...prices)),
        };
    }, [hotels]);

    // Clamp maxPrice to priceRange when hotels first load
    const effectiveMaxPrice =
        filters.maxPrice === Infinity ? priceRange.max : filters.maxPrice;

    // Apply filters + sort
    const filtered = useMemo(() => {
        let list = [...hotels];

        // Star rating
        if (filters.starRatings.length > 0) {
            list = list.filter((h) =>
                h.starRating !== undefined && filters.starRatings.includes(Math.round(h.starRating))
            );
        }

        // Price
        list = list.filter((h) => h.price >= filters.minPrice && h.price <= effectiveMaxPrice);

        // Sort
        if (filters.sortBy === 'price-low') list.sort((a, b) => a.price - b.price);
        else if (filters.sortBy === 'price-high') list.sort((a, b) => b.price - a.price);
        else if (filters.sortBy === 'rating') list.sort((a, b) => (b.reviewScore ?? 0) - (a.reviewScore ?? 0));

        return list;
    }, [hotels, filters, effectiveMaxPrice]);

    const visible = filtered.slice(0, page * PAGE_SIZE);
    const hasMore = visible.length < filtered.length;

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading && hotels.length === 0) {
        return (
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar skeleton */}
                <div className="hidden lg:block w-56 shrink-0 space-y-4 animate-pulse">
                    <div className="h-5 w-20 rounded bg-slate-200 dark:bg-white/10" />
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 rounded-lg bg-slate-200 dark:bg-white/10" />
                    ))}
                </div>
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <div className="h-6 w-48 rounded bg-slate-200 dark:bg-white/10" />
                            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
                        </div>
                    </div>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <HotelCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error && hotels.length === 0) {
        return (
            <div className="text-center py-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Search failed.</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{error}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Desktop Sidebar Filters ──────────────────────────────────────── */}
            <div className="hidden lg:block w-56 shrink-0">
                <div className="sticky top-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-4">
                    <HotelFilters
                        filters={{ ...filters, maxPrice: effectiveMaxPrice }}
                        onChange={updateFilters}
                        onReset={resetFilters}
                        priceRange={priceRange}
                    />
                </div>
            </div>

            {/* ── Mobile Filter Drawer ─────────────────────────────────────────── */}
            {mobileFiltersOpen && (
                <div className="fixed inset-0 z-50 flex lg:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
                    <div className="relative ml-auto w-72 max-w-full h-full bg-white dark:bg-slate-950 p-5 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-900 dark:text-white">Filters</h2>
                            <button onClick={() => setMobileFiltersOpen(false)}>
                                <X size={18} className="text-slate-500" />
                            </button>
                        </div>
                        <HotelFilters
                            filters={{ ...filters, maxPrice: effectiveMaxPrice }}
                            onChange={(next) => { updateFilters(next); }}
                            onReset={resetFilters}
                            priceRange={priceRange}
                        />
                        <Button fullWidth className="mt-6" onClick={() => setMobileFiltersOpen(false)}>
                            Show {filtered.length} results
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Results ──────────────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                    <div>
                        <h1 className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white">
                            {destination ? `Stays in ${destination}` : 'All properties'}
                        </h1>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {loading ? 'Searching…' : `${filtered.length} properties found`}
                        </p>
                    </div>
                    {/* Mobile filters button */}
                    <button
                        onClick={() => setMobileFiltersOpen(true)}
                        className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 transition-colors self-start"
                    >
                        <SlidersHorizontal size={13} />
                        Filters
                    </button>
                </div>

                {/* Sort pills */}
                <div className="mb-4">
                    <SortPills value={filters.sortBy} onChange={(v: SortOption) => updateFilters({ sortBy: v })} />
                </div>

                {/* Loading shimmer on top of existing results */}
                {loading && hotels.length > 0 && (
                    <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Loading prices…
                    </div>
                )}

                {/* Cards */}
                {filtered.length > 0 ? (
                    <div className="space-y-4">
                        {visible.map((hotel, i) => (
                            <HotelCard key={hotel.id} hotel={hotel} index={i} searchQs={searchQs} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                            {destination ? `No hotels found in ${destination}` : 'No properties found'}
                        </h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                            Try adjusting your filters, dates, or searching a nearby city.
                        </p>
                        {(filters.starRatings.length > 0 || filters.maxPrice < priceRange.max) && (
                            <button
                                onClick={resetFilters}
                                className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {/* Load more / done */}
                {filtered.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        {hasMore ? (
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full transition-all active:scale-95 shadow-md shadow-blue-600/20"
                            >
                                Show more ({filtered.length - visible.length} remaining)
                            </button>
                        ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                All {filtered.length} results shown
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
