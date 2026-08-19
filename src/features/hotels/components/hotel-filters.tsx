'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronLeft, SlidersHorizontal, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';

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
     * Which palette to draw from, for a caller whose chrome does not follow the
     * app theme. Defaults to the theme, which is what every in-page use wants.
     *
     * The map view is the one that needs it: its chrome runs *opposite* the
     * theme so it contrasts the basemap, and it forces that by hardcoding
     * `dark` on its own root — under which `dark:` is defined as
     * `:where(.dark, .dark *)` and so can only ever resolve one way, whatever
     * the theme is. A tone prop is how the toolbar and the rail cards already
     * solve this; the panel was the one control still left out of it, which is
     * why it stayed dark while the map's chrome went light.
     */
    tone?: 'light' | 'dark';
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
 * Every colour the panel paints with, picked by tone rather than by a `dark:`
 * variant — see the `tone` prop for why the variant could not be used here.
 *
 * Whole class strings on both branches, never interpolated fragments, so
 * Tailwind's scanner still finds each one.
 */
function filtersPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        /** The panel's plate. The light one carries the lift; the dark one is
         *  already separated from its ground by value alone. */
        panel:   dark ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm',
        heading: dark ? 'text-white' : 'text-slate-900',
        icon:    dark ? 'text-white' : 'text-slate-700',
        /** Section labels and the chevron beside them. */
        muted:   dark ? 'text-white/70' : 'text-slate-500',
        reset:   dark ? 'text-white/60' : 'text-slate-500',
        /** Body copy inside a section — the price row's two labels. */
        body:    dark ? 'text-white/90' : 'text-slate-700',
        /**
         * Selected sort — the same inverted chip the card's price and Book Now
         * use, so "this one is on" looks the same everywhere in the view.
         */
        sortOn:  dark ? 'bg-white text-[#111111]' : 'bg-[#1A1A1A] text-white',
        /** Selected star rating — the slate pill the design puts behind "5 Stars". */
        starOn:  dark ? 'bg-[#5B6472] text-white' : 'bg-slate-800 text-white',
        /** Unselected, for both. */
        rowIdle: dark ? 'text-white/90 hover:bg-white/8' : 'text-slate-700 hover:bg-slate-100',
        track:     dark ? 'bg-white/20' : 'bg-slate-200',
        trackFill: dark ? 'bg-[#E4E4E4]' : 'bg-slate-900',
        thumb: dark
            ? '[&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white'
            : '[&::-webkit-slider-thumb]:bg-slate-900 [&::-moz-range-thumb]:bg-slate-900',
        handle: dark ? 'bg-white/25 text-white' : 'bg-slate-300/90 text-slate-800',
    };
}

type Palette = ReturnType<typeof filtersPalette>;

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
    label, open, onToggle, palette, children,
}: {
    label: string; open: boolean; onToggle: () => void; palette: Palette; children: React.ReactNode;
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
                        'shrink-0 transition-transform duration-200',
                        palette.muted,
                        !open && 'rotate-180',
                    )}
                />
                <span className={cn('text-[13px] tracking-[0.13em] uppercase', palette.muted)}>
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
    min, max, low, high, palette, onChange,
}: {
    min: number; max: number; low: number; high: number;
    palette: Palette;
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
        '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:border-0 ' +
        '[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] ' +
        '[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full ' +
        palette.thumb;

    const input =
        'pointer-events-none absolute inset-0 h-[18px] w-full appearance-none bg-transparent outline-none';

    return (
        <div className="relative h-[18px] px-1">
            {/* Track */}
            <div className={cn('absolute top-1/2 right-1 left-1 h-1.5 -translate-y-1/2 rounded-full', palette.track)}>
                <div
                    className={cn('absolute h-full rounded-full', palette.trackFill)}
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

// ─── Panel ────────────────────────────────────────────────────────────────────

/** One Sort By row. Shared so the caller's options and this panel's own draw
 *  identically rather than as two copies of the same button. */
function SortRow({
    label, active, palette, onClick,
}: {
    label: string; active: boolean; palette: Palette; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-[34px] w-full items-center rounded-full pr-4 pl-[26px] text-left text-[15px] transition-colors',
                active ? palette.sortOn : palette.rowIdle,
            )}
        >
            {label}
        </button>
    );
}

export function HotelFilters({
    filters, onChange, onReset, priceRange, currency = 'USD', onCollapse, tone, showSort = true, sort,
}: HotelFiltersProps) {
    const [open, setOpen] = useState({ sort: true, stars: true, price: true });
    const section = (k: keyof typeof open) => () => setOpen((s) => ({ ...s, [k]: !s[k] }));
    const { theme } = useTheme();
    const palette = filtersPalette(tone ?? theme);

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
            <aside className={cn('w-full overflow-hidden rounded-[20px]', palette.panel)}>
                {/* Still scrolls when the sections outgrow the viewport — the bar
                    is what's gone, not the overflow. A 3px thumb on a panel this
                    narrow was mostly a seam down its right edge. */}
                <div className="no-scrollbar max-h-[calc(100dvh-7rem)] overflow-y-auto px-[18px] py-6">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-1">
                        <SlidersHorizontal size={17} strokeWidth={1.75} className={cn('shrink-0', palette.icon)} />
                        <span className={cn('text-[17px]', palette.heading)}>Filters</span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={onReset}
                                className={cn('ml-auto text-[12px] underline-offset-2 hover:underline', palette.reset)}
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
                        <Section label="Sort By" open={open.sort} onToggle={section('sort')} palette={palette}>
                            {sort
                                ? sort.options.map((opt) => (
                                    <SortRow
                                        key={opt.value}
                                        label={opt.label}
                                        active={sort.value === opt.value}
                                        palette={palette}
                                        onClick={() => sort.onChange(opt.value)}
                                    />
                                ))
                                : SORT_OPTIONS.map((opt) => (
                                    <SortRow
                                        key={opt.value}
                                        label={opt.label}
                                        active={filters.sortBy === opt.value}
                                        palette={palette}
                                        onClick={() => onChange({ sortBy: opt.value })}
                                    />
                                ))}
                        </Section>
                        )}

                        {/* Star rating */}
                        <Section label="Star Rating" open={open.stars} onToggle={section('stars')} palette={palette}>
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
                                            active ? palette.starOn : palette.rowIdle,
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
                        <Section label="Price / Night" open={open.price} onToggle={section('price')} palette={palette}>
                            <div className="px-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className={cn('text-[15px]', palette.body)}>Adjust Price</span>
                                    <span className={cn('text-[15px] whitespace-nowrap', palette.body)}>
                                        {sym}{Math.round(filters.minPrice).toLocaleString()}-{Math.round(filters.maxPrice).toLocaleString()}
                                    </span>
                                </div>

                                <div className="mt-6">
                                    <PriceRangeSlider
                                        min={priceRange.min}
                                        max={priceRange.max}
                                        low={filters.minPrice}
                                        high={filters.maxPrice}
                                        palette={palette}
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
                    className={cn(
                        'absolute top-1/2 -right-5 z-10 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-sm transition-opacity hover:opacity-85',
                        palette.handle,
                    )}
                >
                    <ChevronLeft size={20} strokeWidth={1.75} />
                </button>
            )}
        </div>
    );
}
