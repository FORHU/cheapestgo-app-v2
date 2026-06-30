'use client';

import React, { useMemo, useState } from 'react';
import { Plane, SlidersHorizontal, X } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import type { FlightOffer } from '@/shared/types';
import { FlightCard } from './flight-card';
import { FlightFilters, DEFAULT_FLIGHT_FILTERS } from './flight-filters';
import type { FlightFilterState } from './flight-filters';

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function FlightCardSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 p-4 flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-32 hidden md:block" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-px flex-1" />
                    <Skeleton className="h-5 w-14" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
            </div>
            <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-3 lg:w-44 pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 shrink-0 lg:pl-4">
                <div className="space-y-1">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
        </div>
    );
}

// ─── FlightResults ────────────────────────────────────────────────────────────

interface FlightResultsProps {
    offers: FlightOffer[];
    loading: boolean;
    adults?: number;
    skeletonCount?: number;
    className?: string;
}

export function FlightResults({
    offers,
    loading,
    adults = 1,
    skeletonCount = 6,
    className,
}: FlightResultsProps) {
    const [filters, setFilters] = useState<FlightFilterState>(DEFAULT_FLIGHT_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const handleFilterChange = (partial: Partial<FlightFilterState>) => {
        setFilters((prev) => ({ ...prev, ...partial }));
    };

    const highestPrice = useMemo(() => {
        if (offers.length === 0) return 5000;
        return Math.ceil(Math.max(...offers.map((o) => parseFloat(o.totalAmount))));
    }, [offers]);

    const filteredOffers = useMemo(() => {
        let result = [...offers];

        // Filter by max stops
        if (filters.maxStops !== null) {
            result = result.filter((o) => {
                const outbound = o.slices[0];
                if (!outbound) return true;
                const stops = Math.max(0, outbound.segments.length - 1);
                return stops <= filters.maxStops!;
            });
        }

        // Filter by max price
        if (filters.maxPrice < highestPrice) {
            result = result.filter((o) => parseFloat(o.totalAmount) <= filters.maxPrice);
        }

        // Sort
        if (filters.sortBy === 'price') {
            result.sort((a, b) => parseFloat(a.totalAmount) - parseFloat(b.totalAmount));
        } else if (filters.sortBy === 'duration') {
            result.sort((a, b) => {
                const durA = a.slices.reduce((sum, s) => sum + s.duration, 0);
                const durB = b.slices.reduce((sum, s) => sum + s.duration, 0);
                return durA - durB;
            });
        } else if (filters.sortBy === 'departure') {
            result.sort((a, b) => {
                const tA = new Date(a.slices[0]?.departureAt ?? 0).getTime();
                const tB = new Date(b.slices[0]?.departureAt ?? 0).getTime();
                return tA - tB;
            });
        }

        return result;
    }, [offers, filters, highestPrice]);

    const activeFilterCount =
        (filters.maxStops !== null ? 1 : 0) +
        (filters.maxPrice < highestPrice ? 1 : 0) +
        (filters.sortBy !== 'price' ? 1 : 0);

    // ─── Loading skeleton ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className={cn('space-y-3', className)}>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                    <FlightCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    // ─── Empty state ───────────────────────────────────────────────────────────

    if (offers.length === 0) {
        return (
            <div className={cn(
                'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10',
                'rounded-2xl p-12 text-center space-y-3',
                className
            )}>
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Plane className="text-blue-500" size={24} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">No flights found</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Try adjusting your search — different dates or nearby airports often have better fares.
                </p>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col lg:flex-row gap-4 lg:items-start', className)}>
            {/* Desktop sidebar filters */}
            <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5">
                        <SlidersHorizontal size={13} />
                        Filters
                    </p>
                    <FlightFilters
                        filters={filters}
                        onChange={handleFilterChange}
                        highestPrice={highestPrice}
                    />
                </div>
            </aside>

            {/* Results column */}
            <div className="flex-1 min-w-0 space-y-3">
                {/* Mobile filter bar */}
                <div className="flex items-center justify-between lg:hidden">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {filteredOffers.length} flight{filteredOffers.length !== 1 ? 's' : ''}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFiltersOpen((v) => !v)}
                        className="gap-1.5 text-xs"
                    >
                        <SlidersHorizontal size={12} />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="ml-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                </div>

                {/* Mobile filter drawer */}
                {filtersOpen && (
                    <div className="lg:hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 p-4 shadow-sm space-y-1">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">Filters</p>
                            <button
                                onClick={() => setFiltersOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <X size={14} className="text-slate-500" />
                            </button>
                        </div>
                        <FlightFilters
                            filters={filters}
                            onChange={handleFilterChange}
                            highestPrice={highestPrice}
                        />
                        <div className="pt-3">
                            <Button
                                fullWidth
                                size="sm"
                                onClick={() => setFiltersOpen(false)}
                            >
                                Show {filteredOffers.length} flights
                            </Button>
                        </div>
                    </div>
                )}

                {/* Result count (desktop) */}
                <div className="hidden lg:flex items-center justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {filteredOffers.length} of {offers.length} flight{offers.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* No results after filtering */}
                {filteredOffers.length === 0 && offers.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            No flights match your filters
                        </p>
                        <button
                            onClick={() => setFilters(DEFAULT_FLIGHT_FILTERS)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Clear filters
                        </button>
                    </div>
                )}

                {/* Flight cards */}
                {filteredOffers.map((offer) => (
                    <FlightCard key={offer.id} offer={offer} adults={adults} />
                ))}
            </div>
        </div>
    );
}
