'use client';

import React, { useMemo, useState } from 'react';
import { HotelCard, HotelCardSkeleton, type HotelResult } from './hotel-card';
import { HotelFilters, type HotelFiltersState } from './hotel-filters';
import { SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/shared/components/ui/button';

const PAGE_SIZE = 20;

/** The panel's width, and the width of the column once it is only the handle. */
const PANEL_W  = 280;
const HANDLE_W = 42;
/**
 * The slide the column and the results share.
 *
 * One transition for both because they are one movement: the results take their
 * width from the column, so animating the column is what carries them across
 * instead of letting them jump.
 */
const FILTER_SLIDE = { type: 'spring' as const, damping: 30, stiffness: 260, mass: 0.7 };
/** The panel's own fade, short enough to be gone before the column has finished
 *  closing under it. */
const PANEL_FADE = { duration: 0.18 };

/**
 * `±Infinity` means "not set": the price bounds are only known once results have
 * streamed in, and a concrete 0 would read as a deliberate filter the moment the
 * cheapest stay costs more than nothing.
 */
const DEFAULT_FILTERS: HotelFiltersState = {
    sortBy: 'recommended',
    starRatings: [],
    minPrice: -Infinity,
    maxPrice: Infinity,
};

interface HotelResultsProps {
    hotels: HotelResult[];
    loading: boolean;
    error: string | null;
    destination: string;
    searchQs: string;
    /**
     * The filters, driven from outside.
     *
     * Passing `onFiltersChange` hands them over: the caller owns the values and
     * draws its own panel, so the mobile drawer and the trigger that opens it
     * both go — the search page hangs a dropdown off its toolbar instead, the
     * way the map view does. The desktop sidebar stays either way, reading
     * whichever state is in charge.
     *
     * Left off, the filters are this component's own and the drawer comes back
     * with them, which is how the destinations page still gets both.
     */
    filters?: HotelFiltersState;
    onFiltersChange?: (next: Partial<HotelFiltersState>) => void;
    onFiltersReset?: () => void;
}

export function HotelResults({
    hotels, loading, error, destination, searchQs,
    filters: controlledFilters, onFiltersChange, onFiltersReset,
}: HotelResultsProps) {
    const [ownFilters, setOwnFilters] = useState<HotelFiltersState>(DEFAULT_FILTERS);
    const [page, setPage] = useState(1);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);

    const controlled = onFiltersChange !== undefined;
    const filters = controlled ? controlledFilters ?? DEFAULT_FILTERS : ownFilters;

    const updateFilters = (next: Partial<HotelFiltersState>) => {
        if (onFiltersChange) onFiltersChange(next);
        else setOwnFilters((f) => ({ ...f, ...next }));
        setPage(1);
    };

    const resetFilters = () => {
        if (onFiltersReset) onFiltersReset();
        else setOwnFilters(DEFAULT_FILTERS);
        setPage(1);
    };

    // Price range derived from results
    const priceRange = useMemo(() => {
        const prices = hotels.map((h) => h.price).filter((p) => p > 0);
        if (prices.length === 0) return { min: 0, max: 1000 };
        const min = Math.floor(Math.min(...prices));
        const max = Math.ceil(Math.max(...prices));
        // A single price point would give the slider a zero-width track.
        return { min, max: max > min ? max : min + 1 };
    }, [hotels]);

    // Unset bounds fall back to the range; set ones are clamped to it, since the
    // range keeps widening while results stream.
    const minPrice = Number.isFinite(filters.minPrice)
        ? Math.max(filters.minPrice, priceRange.min)
        : priceRange.min;
    const maxPrice = Number.isFinite(filters.maxPrice)
        ? Math.min(filters.maxPrice, priceRange.max)
        : priceRange.max;

    const priceFiltered = minPrice > priceRange.min || maxPrice < priceRange.max;
    const currency = hotels[0]?.currency ?? 'USD';

    // Apply filters + sort
    const filtered = useMemo(() => {
        let list = [...hotels];

        if (filters.starRatings.length > 0) {
            list = list.filter(
                (h) => h.starRating !== undefined && filters.starRatings.includes(Math.round(h.starRating)),
            );
        }

        list = list.filter((h) => h.price >= minPrice && h.price <= maxPrice);

        // "Cheapest First" and "Low to Highest" are the same ordering under two
        // of the design's labels.
        if (filters.sortBy === 'cheapest' || filters.sortBy === 'price-low') {
            list.sort((a, b) => a.price - b.price);
        } else if (filters.sortBy === 'price-high') {
            list.sort((a, b) => b.price - a.price);
        } else if (filters.sortBy === 'top-rated') {
            list.sort((a, b) => (b.reviewScore ?? 0) - (a.reviewScore ?? 0));
        }

        return list;
    }, [hotels, filters.starRatings, filters.sortBy, minPrice, maxPrice]);

    const visible = filtered.slice(0, page * PAGE_SIZE);
    const hasMore = visible.length < filtered.length;

    const panelProps = {
        filters: { ...filters, minPrice, maxPrice },
        onChange: updateFilters,
        onReset: resetFilters,
        priceRange,
        currency,
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading && hotels.length === 0) {
        return (
            <div className="flex flex-col gap-6 lg:flex-row">
                <div className="hidden w-[280px] shrink-0 animate-pulse lg:block">
                    <div className="h-[520px] rounded-[20px] bg-slate-200 dark:bg-[#1A1A1A]" />
                </div>
                <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                        <div className="h-6 w-48 rounded bg-slate-200 dark:bg-white/10" />
                        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
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
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-20 text-center dark:border-white/10 dark:bg-[#1A1A1A]">
                <p className="text-sm font-medium text-slate-500 dark:text-white/70">Search failed.</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-white/40">{error}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
            {/* One column that animates between the two widths, rather than two
                columns that swap. The results are `flex-1` off this, so the
                column's width is what slides them across.

                Deliberately not clipped to that width: the panel's collapse
                handle straddles its right edge, and `overflow: hidden` here
                would cut the handle in half. The panel instead fades as it
                slides, and since the results come after it in the DOM they paint
                over whatever briefly overhangs — so it reads as the panel
                sliding out behind them. */}
            <motion.div
                className="relative hidden shrink-0 lg:block"
                initial={false}
                animate={{ width: filtersCollapsed ? HANDLE_W : PANEL_W }}
                transition={FILTER_SLIDE}
            >
                <div className="sticky top-24">
                    {/* `mode="wait"` so the handle arrives into an empty column
                        instead of crossing the panel on its way out. */}
                    <AnimatePresence initial={false} mode="wait">
                        {filtersCollapsed ? (
                            <motion.button
                                key="show-filters"
                                type="button"
                                onClick={() => setFiltersCollapsed(false)}
                                aria-label="Show filters"
                                title="Show filters"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={PANEL_FADE}
                                className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-slate-300/90 text-slate-800 transition-opacity hover:opacity-85 dark:bg-white/25 dark:text-white"
                            >
                                <SlidersHorizontal size={19} strokeWidth={1.75} />
                            </motion.button>
                        ) : (
                            <motion.div
                                key="filters"
                                initial={{ opacity: 0, x: -14 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -14 }}
                                transition={PANEL_FADE}
                                // Held at its own width: the column shrinks out
                                // from under it, and a percentage width would
                                // shrink the panel's contents with it.
                                style={{ width: PANEL_W }}
                            >
                                <HotelFilters {...panelProps} onCollapse={() => setFiltersCollapsed(true)} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* ── Mobile filter drawer ─────────────────────────────────────────── */}
            {/* The same control at the other breakpoint, so it hides the same
                way: the scrim fades and the sheet slides back off the right edge
                it came in from. The scrim carries the fade on the outer element
                because that is AnimatePresence's own child — the sheet's slide
                is a nested motion component and rides the same exit.

                Gone once a caller controls the filters: it draws the small-screen
                surface itself, and a drawer nothing can open is dead weight. */}
            <AnimatePresence>
                {!controlled && mobileFiltersOpen && (
                    <motion.div
                        key="filter-drawer"
                        className="fixed inset-0 z-50 flex lg:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setMobileFiltersOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={FILTER_SLIDE}
                            className="no-scrollbar relative ml-auto h-full w-[320px] max-w-full overflow-y-auto bg-slate-50 p-4 dark:bg-[#141414]"
                        >
                            <div className="mb-3 flex items-center justify-end">
                                <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                                    <X size={18} className="text-slate-500 dark:text-white/60" />
                                </button>
                            </div>
                            <HotelFilters {...panelProps} />
                            <Button fullWidth className="mt-6" onClick={() => setMobileFiltersOpen(false)}>
                                Show {filtered.length} results
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Results ──────────────────────────────────────────────────────── */}
            <div className="min-w-0 flex-1">
                {/* Header */}
                <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 md:text-2xl dark:text-white">
                            {destination ? `Stays in ${destination}` : 'All properties'}
                        </h1>
                        <p className="mt-0.5 text-xs text-slate-500 md:text-sm dark:text-white/55">
                            {loading ? 'Searching…' : `${filtered.length} properties found`}
                        </p>
                    </div>
                    {/* The drawer's own trigger, for as long as the drawer is
                        its own. A controlling caller draws the button itself —
                        the search page puts it in the toolbar — and two of them
                        on the same screen would be one too many. */}
                    {!controlled && (
                        <button
                            onClick={() => setMobileFiltersOpen(true)}
                            className="flex items-center gap-2 self-start rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 lg:hidden dark:border-white/15 dark:text-white/80 dark:hover:border-white/35"
                        >
                            <SlidersHorizontal size={13} />
                            Filters
                        </button>
                    )}
                </div>

                {loading && hotels.length > 0 && (
                    <div className="mb-4 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600 dark:bg-white/8 dark:text-white/70">
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
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center dark:border-white/10 dark:bg-[#1A1A1A]">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                            {destination ? `No hotels found in ${destination}` : 'No properties found'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400 dark:text-white/50">
                            Try adjusting your filters, dates, or searching a nearby city.
                        </p>
                        {(filters.starRatings.length > 0 || priceFiltered) && (
                            <button
                                onClick={resetFilters}
                                className="mt-3 text-xs text-slate-600 underline-offset-2 hover:underline dark:text-white/70"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {/* Load more / done */}
                {filtered.length > 0 && (
                    <div className="mt-8 flex justify-center">
                        {hasMore ? (
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                className="rounded-full bg-[#1A1A1A] px-6 py-2.5 text-xs font-bold text-white transition-transform active:scale-95 dark:bg-white dark:text-[#111111]"
                            >
                                Show more ({filtered.length - visible.length} remaining)
                            </button>
                        ) : (
                            <span className="text-xs text-slate-400 dark:text-white/40">
                                All {filtered.length} results shown
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
