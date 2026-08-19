'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronLeft, SlidersHorizontal, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';

/**
 * The accordion slide.
 *
 * A tween rather than the spring the sidebar column uses: this animates to
 * `height: auto`, which framer-motion resolves by measuring the content, and a
 * spring overshoots that measurement — with the box clipped, the overshoot reads
 * as the rows springing past their own container and back. 220ms also matches
 * the chevron's own rotation, which is already a tween at that duration.
 */
const SECTION_SLIDE = {
    duration: 0.22,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

/**
 * The five options the design lists. `cheapest` and `price-low` are the same
 * ordering under two of the design's labels ("Cheapest First" / "Low to
 * Highest"); they stay separate values so each row selects independently.
 */
export type SortOption = 'recommended' | 'cheapest' | 'top-rated' | 'price-high' | 'price-low';

export interface HotelFiltersState {
    sortBy: SortOption;
    starRatings: number[];   // selected star categories (1-5)
    minPrice: number;
    maxPrice: number;
}

interface HotelFiltersProps {
    filters: HotelFiltersState;
    onChange: (next: Partial<HotelFiltersState>) => void;
    onReset: () => void;
    priceRange: { min: number; max: number };
    /** Drives the `$0-100` readout in the price section. */
    currency?: string;
    /** Rendered as the handle on the panel's right edge when provided. */
    onCollapse?: () => void;
    /**
     * Draw the Sort By section from this panel's own options, against
     * `filters.sortBy`. Ignored when `sort` is supplied.
     */
    showSort?: boolean;
    /**
     * Sort supplied by the caller: its own options, its own value, its own
     * handler — replacing both the rows below and `filters.sortBy`.
     *
     * The map view needs this. Its toolbar sorts by a different vocabulary than
     * this panel's — it carries "Most Reviewed", which has no row here, and
     * splits cheapest from low-to-high differently — and the value it sorts by
     * lives up on the search page beside the sort pill. Handing it in puts the
     * toolbar's own list in the panel, driving the toolbar's own state, so the
     * two never disagree. On a phone it is the only way to sort the map at all:
     * the pill is desktop-only.
     */
    sort?: {
        value: string;
        options: readonly { value: string; label: string }[];
        onChange: (value: string) => void;
    };
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'cheapest',    label: 'Cheapest First' },
    { value: 'top-rated',   label: 'Top Rated' },
    { value: 'price-high',  label: 'Highest to Low' },
    { value: 'price-low',   label: 'Low to Highest' },
];

const STAR_OPTIONS = [5, 4, 3, 2, 1];

/**
 * Selected sort — the same inverted chip the card's price and Book Now use, so
 * "this one is on" looks the same everywhere in the view.
 */
const SELECTED_SORT = 'bg-[#1A1A1A] text-white dark:bg-white dark:text-[#111111]';
/** Selected star rating — the slate pill the design puts behind "5 Stars". */
const SELECTED_STAR = 'bg-slate-800 text-white dark:bg-[#5B6472]';
/** Unselected, for both. */
const IDLE_ROW = 'text-slate-700 hover:bg-slate-100 dark:text-white/90 dark:hover:bg-white/8';

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
    label, open, onToggle, children,
}: {
    label: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 px-1 text-left"
            >
                <ChevronUp
                    size={16}
                    strokeWidth={1.75}
                    className={cn(
                        'shrink-0 text-slate-500 transition-transform duration-200 dark:text-white/70',
                        !open && 'rotate-180',
                    )}
                />
                <span className="text-[13px] tracking-[0.13em] text-slate-500 uppercase dark:text-white/70">
                    {label}
                </span>
            </button>

            {/* `initial={false}` because all three sections start open: without
                it the panel would animate itself apart on first paint. */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={SECTION_SLIDE}
                        // Clips the rows to the collapsing box. Without it they
                        // stay drawn at full height and simply slide up over the
                        // section below.
                        style={{ overflow: 'hidden' }}
                    >
                        {/* The top margin belongs to the *inner* box. On the
                            animated one it would survive `height: 0` and leave a
                            14px gap under every closed section. */}
                        {/* 34px rows on a 42px pitch, as drawn. */}
                        <div className="mt-[14px] flex flex-col gap-2">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Price slider ─────────────────────────────────────────────────────────────

/**
 * The design's two-handle range. Two native range inputs stacked on one track:
 * the inputs themselves are pointer-transparent so the lower one doesn't
 * swallow clicks meant for the upper, and only the thumbs opt back in.
 *
 * When the low handle is near the top of the track both thumbs land on the same
 * spot, so the low input is lifted above the high one there — otherwise the
 * high input covers it and the range can never be widened again.
 */
function PriceRangeSlider({
    min, max, low, high, onChange,
}: {
    min: number; max: number; low: number; high: number;
    onChange: (low: number, high: number) => void;
}) {
    const span = Math.max(1, max - min);
    const step = Math.max(1, Math.round(span / 100));
    const lowPct = ((low - min) / span) * 100;
    const highPct = ((high - min) / span) * 100;

    const thumb =
        '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none ' +
        '[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] ' +
        '[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:rounded-full ' +
        '[&::-webkit-slider-thumb]:bg-slate-900 dark:[&::-webkit-slider-thumb]:bg-white ' +
        '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:border-0 ' +
        '[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] ' +
        '[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full ' +
        '[&::-moz-range-thumb]:bg-slate-900 dark:[&::-moz-range-thumb]:bg-white';

    const input =
        'pointer-events-none absolute inset-0 h-[18px] w-full appearance-none bg-transparent outline-none';

    return (
        <div className="relative h-[18px] px-1">
            {/* Track */}
            <div className="absolute top-1/2 right-1 left-1 h-1.5 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-white/20">
                <div
                    className="absolute h-full rounded-full bg-slate-900 dark:bg-[#E4E4E4]"
                    style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
                />
            </div>

            <input
                type="range"
                aria-label="Minimum price per night"
                min={min} max={max} step={step} value={low}
                onChange={(e) => onChange(Math.min(Number(e.target.value), high), high)}
                className={cn(input, thumb)}
                style={{ zIndex: lowPct > 80 ? 5 : 3 }}
            />
            <input
                type="range"
                aria-label="Maximum price per night"
                min={min} max={max} step={step} value={high}
                onChange={(e) => onChange(low, Math.max(Number(e.target.value), low))}
                className={cn(input, thumb)}
                style={{ zIndex: 4 }}
            />
        </div>
    );
}

/** `$`, `₱`, `€` … — whatever `Intl` prefixes the amount with. */
function currencySymbol(currency: string): string {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
            .format(0)
            .replace(/[\d\s., ]/g, '');
    } catch {
        return '';
    }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/** One Sort By row. Shared so the caller's options and this panel's own draw
 *  identically rather than as two copies of the same button. */
function SortRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-[34px] w-full items-center rounded-full pr-4 pl-[26px] text-left text-[15px] transition-colors',
                active ? SELECTED_SORT : IDLE_ROW,
            )}
        >
            {label}
        </button>
    );
}

export function HotelFilters({
    filters, onChange, onReset, priceRange, currency = 'USD', onCollapse, showSort = true, sort,
}: HotelFiltersProps) {
    const [open, setOpen] = useState({ sort: true, stars: true, price: true });
    const section = (k: keyof typeof open) => () => setOpen((s) => ({ ...s, [k]: !s[k] }));

    const toggleStar = (star: number) => {
        const next = filters.starRatings.includes(star)
            ? filters.starRatings.filter((s) => s !== star)
            : [...filters.starRatings, star].sort((a, b) => b - a);
        onChange({ starRatings: next });
    };

    // Both vocabularies call the neutral order `recommended`, so one test
    // covers the caller's sort and this panel's own.
    const sortNarrowed = sort ? sort.value !== 'recommended' : showSort && filters.sortBy !== 'recommended';

    const hasActiveFilters =
        sortNarrowed ||
        filters.starRatings.length > 0 ||
        filters.minPrice > priceRange.min ||
        filters.maxPrice < priceRange.max;

    const sym = currencySymbol(currency);

    return (
        <div className="relative">
            {/* Same surface as the map view's rail cards, so the panel and the
                results it filters read as one material. */}
            <aside className="w-full overflow-hidden rounded-[20px] bg-white shadow-sm dark:bg-[#1A1A1A] dark:shadow-none">
                {/* Still scrolls when the sections outgrow the viewport — the bar
                    is what's gone, not the overflow. A 3px thumb on a panel this
                    narrow was mostly a seam down its right edge. */}
                <div className="no-scrollbar max-h-[calc(100dvh-7rem)] overflow-y-auto px-[18px] py-6">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-1">
                        <SlidersHorizontal size={17} strokeWidth={1.75} className="shrink-0 text-slate-700 dark:text-white" />
                        <span className="text-[17px] text-slate-900 dark:text-white">Filters</span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={onReset}
                                className="ml-auto text-[12px] text-slate-500 underline-offset-2 hover:underline dark:text-white/60"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="mt-7 space-y-6">
                        {/* Sort. The caller's options when it supplies them,
                            this panel's own otherwise — see the `sort` prop.
                            Kept as two branches rather than one merged list so
                            each keeps its own value type. */}
                        {(sort || showSort) && (
                        <Section label="Sort By" open={open.sort} onToggle={section('sort')}>
                            {sort
                                ? sort.options.map((opt) => (
                                    <SortRow
                                        key={opt.value}
                                        label={opt.label}
                                        active={sort.value === opt.value}
                                        onClick={() => sort.onChange(opt.value)}
                                    />
                                ))
                                : SORT_OPTIONS.map((opt) => (
                                    <SortRow
                                        key={opt.value}
                                        label={opt.label}
                                        active={filters.sortBy === opt.value}
                                        onClick={() => onChange({ sortBy: opt.value })}
                                    />
                                ))}
                        </Section>
                        )}

                        {/* Star rating */}
                        <Section label="Star Rating" open={open.stars} onToggle={section('stars')}>
                            {STAR_OPTIONS.map((star) => {
                                const active = filters.starRatings.includes(star);
                                return (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => toggleStar(star)}
                                        aria-pressed={active}
                                        className={cn(
                                            'flex h-[34px] w-full items-center justify-between gap-3 rounded-full pr-4 pl-[26px] text-left text-[15px] transition-colors',
                                            active ? SELECTED_STAR : IDLE_ROW,
                                        )}
                                    >
                                        <span>{star === 1 ? '1 Star' : `${star} Stars`}</span>
                                        <span className="flex shrink-0 items-center gap-px">
                                            {Array.from({ length: star }).map((_, i) => (
                                                <Star key={i} size={13} className="fill-current stroke-none" />
                                            ))}
                                        </span>
                                    </button>
                                );
                            })}
                        </Section>

                        {/* Price */}
                        <Section label="Price / Night" open={open.price} onToggle={section('price')}>
                            <div className="px-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[15px] text-slate-700 dark:text-white/90">Adjust Price</span>
                                    <span className="text-[15px] whitespace-nowrap text-slate-700 dark:text-white/90">
                                        {sym}{Math.round(filters.minPrice).toLocaleString()}-{Math.round(filters.maxPrice).toLocaleString()}
                                    </span>
                                </div>

                                <div className="mt-6">
                                    <PriceRangeSlider
                                        min={priceRange.min}
                                        max={priceRange.max}
                                        low={filters.minPrice}
                                        high={filters.maxPrice}
                                        onChange={(lo, hi) => onChange({ minPrice: lo, maxPrice: hi })}
                                    />
                                </div>
                            </div>
                        </Section>
                    </div>
                </div>
            </aside>

            {/* Collapse handle — straddles the panel's right edge */}
            {onCollapse && (
                <button
                    type="button"
                    onClick={onCollapse}
                    aria-label="Hide filters"
                    className="absolute top-1/2 -right-5 z-10 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-slate-300/90 text-slate-800 backdrop-blur-sm transition-opacity hover:opacity-85 dark:bg-white/25 dark:text-white"
                >
                    <ChevronLeft size={20} strokeWidth={1.75} />
                </button>
            )}
        </div>
    );
}
