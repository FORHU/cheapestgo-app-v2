'use client';

import React from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/components/ui/button';
import { Star } from 'lucide-react';

export type SortOption = 'recommended' | 'price-low' | 'price-high' | 'rating';

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
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'price-low',   label: 'Cheapest first' },
    { value: 'price-high',  label: 'Price: High to Low' },
    { value: 'rating',      label: 'Top Rated' },
];

const STAR_OPTIONS = [5, 4, 3, 2, 1];

export function HotelFilters({ filters, onChange, onReset, priceRange }: HotelFiltersProps) {
    const toggleStar = (star: number) => {
        const next = filters.starRatings.includes(star)
            ? filters.starRatings.filter((s) => s !== star)
            : [...filters.starRatings, star].sort((a, b) => b - a);
        onChange({ starRatings: next });
    };

    const hasActiveFilters =
        filters.sortBy !== 'recommended' ||
        filters.starRatings.length > 0 ||
        filters.minPrice > priceRange.min ||
        filters.maxPrice < priceRange.max;

    return (
        <aside className="w-full space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Filters</h2>
                {hasActiveFilters && (
                    <button
                        onClick={onReset}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                        Reset all
                    </button>
                )}
            </div>

            {/* Sort */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Sort by</p>
                <div className="flex flex-col gap-1">
                    {SORT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onChange({ sortBy: opt.value })}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                                filters.sortBy === opt.value
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Star rating */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Star rating</p>
                <div className="flex flex-col gap-1.5">
                    {STAR_OPTIONS.map((star) => {
                        const active = filters.starRatings.includes(star);
                        return (
                            <button
                                key={star}
                                onClick={() => toggleStar(star)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
                                    active
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700',
                                )}
                            >
                                <div className="flex items-center gap-0.5">
                                    {Array.from({ length: star }).map((_, i) => (
                                        <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <span>{star === 1 ? '1 star' : `${star} stars`}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Price range */}
            {priceRange.max > priceRange.min && (
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Price per night
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{filters.minPrice.toLocaleString()}</span>
                            <span>{filters.maxPrice.toLocaleString()}</span>
                        </div>
                        <input
                            type="range"
                            min={priceRange.min}
                            max={priceRange.max}
                            value={filters.maxPrice}
                            step={Math.ceil((priceRange.max - priceRange.min) / 50)}
                            onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
                            className="w-full accent-blue-600"
                        />
                    </div>
                </div>
            )}
        </aside>
    );
}

// ─── Sort pills (inline, used on mobile or compact layouts) ──────────────────

interface SortPillsProps {
    value: SortOption;
    onChange: (v: SortOption) => void;
}

export function SortPills({ value, onChange }: SortPillsProps) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                        value === opt.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
