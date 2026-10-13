'use client';

import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { ChevronLeft, SlidersHorizontal, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';
import { filtersPalette, FilterSection, FilterRow, RangeSlider } from '@/shared/components/ui/filter-panel';

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

// ─── Panel ────────────────────────────────────────────────────────────────────

export function HotelFilters({
    filters, onChange, onReset, priceRange, currency = 'USD', onCollapse, tone, showSort = true, sort,
}: HotelFiltersProps) {
    const tAll = useTranslations();
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
                        <span className={cn('text-[17px]', palette.heading)}>{tAll('flights.results.filters')}</span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={onReset}
                                className={cn('ml-auto text-[12px] underline-offset-2 hover:underline', palette.reset)}
                            >
                                {tAll('hotels.filters.reset')}
                            </button>
                        )}
                    </div>

                    <div className="mt-7 space-y-6">
                        {/* Sort. The caller's options when it supplies them,
                            this panel's own otherwise — see the `sort` prop.
                            Kept as two branches rather than one merged list so
                            each keeps its own value type. */}
                        {(sort || showSort) && (
                        <FilterSection label="Sort By" open={open.sort} onToggle={section('sort')} palette={palette}>
                            {sort
                                ? sort.options.map((opt) => (
                                    <FilterRow
                                        key={opt.value}
                                        label={opt.label}
                                        active={sort.value === opt.value}
                                        palette={palette}
                                        onClick={() => sort.onChange(opt.value)}
                                    />
                                ))
                                : SORT_OPTIONS.map((opt) => (
                                    <FilterRow
                                        key={opt.value}
                                        label={opt.label}
                                        active={filters.sortBy === opt.value}
                                        palette={palette}
                                        onClick={() => onChange({ sortBy: opt.value })}
                                    />
                                ))}
                        </FilterSection>
                        )}

                        {/* Star rating */}
                        <FilterSection label="Star Rating" open={open.stars} onToggle={section('stars')} palette={palette}>
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
                                            active ? palette.rowOn : palette.rowIdle,
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
                        </FilterSection>

                        {/* Price */}
                        <FilterSection label="Price / Night" open={open.price} onToggle={section('price')} palette={palette}>
                            <div className="px-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className={cn('text-[15px]', palette.body)}>{tAll('hotels.filters.adjustPrice')}</span>
                                    <span className={cn('text-[15px] whitespace-nowrap', palette.body)}>
                                        {sym}{Math.round(filters.minPrice).toLocaleString()}-{Math.round(filters.maxPrice).toLocaleString()}
                                    </span>
                                </div>

                                <div className="mt-6">
                                    <RangeSlider
                                        min={priceRange.min}
                                        max={priceRange.max}
                                        low={filters.minPrice}
                                        high={filters.maxPrice}
                                        palette={palette}
                                        lowLabel={tAll('hotels.filters.minPerNight')}
                                        highLabel={tAll('hotels.filters.maxPerNight')}
                                        onChange={(lo, hi) => onChange({ minPrice: lo, maxPrice: hi })}
                                    />
                                </div>
                            </div>
                        </FilterSection>
                    </div>
                </div>
            </aside>

            {/* Collapse handle — straddles the panel's right edge */}
            {onCollapse && (
                <button
                    type="button"
                    onClick={onCollapse}
                    aria-label={tAll('hotels.filters.hide')}
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
