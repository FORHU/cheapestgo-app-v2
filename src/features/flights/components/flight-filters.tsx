'use client';

import React from 'react';
import { ArrowUpDown, Filter } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortBy = 'price' | 'duration' | 'departure';
export type MaxStops = null | 0 | 1;

export interface FlightFilterState {
    sortBy: SortBy;
    maxStops: MaxStops;
    minPrice: number;
    maxPrice: number;
}

export const DEFAULT_FLIGHT_FILTERS: FlightFilterState = {
    sortBy: 'price',
    maxStops: null,
    minPrice: 0,
    maxPrice: 99999,
};

interface FlightFiltersProps {
    filters: FlightFilterState;
    onChange: (f: Partial<FlightFilterState>) => void;
    /** Used to set the max bound on the price slider */
    highestPrice?: number;
    className?: string;
}

// ─── Pill Button ──────────────────────────────────────────────────────────────

function Pill({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
            )}
        >
            {children}
        </button>
    );
}

// ─── FlightFilters ────────────────────────────────────────────────────────────

export function FlightFilters({ filters, onChange, highestPrice = 5000, className }: FlightFiltersProps) {
    const effectiveMax = Math.max(highestPrice, filters.maxPrice);

    return (
        <div className={cn('space-y-5', className)}>
            {/* Sort */}
            <section>
                <div className="flex items-center gap-1.5 mb-2">
                    <ArrowUpDown size={13} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Sort by
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {([
                        { value: 'price',     label: 'Price' },
                        { value: 'duration',  label: 'Duration' },
                        { value: 'departure', label: 'Departure' },
                    ] as { value: SortBy; label: string }[]).map(({ value, label }) => (
                        <Pill
                            key={value}
                            active={filters.sortBy === value}
                            onClick={() => onChange({ sortBy: value })}
                        >
                            {label}
                        </Pill>
                    ))}
                </div>
            </section>

            {/* Stops */}
            <section>
                <div className="flex items-center gap-1.5 mb-2">
                    <Filter size={13} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Max stops
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {([
                        { value: null, label: 'Any' },
                        { value: 0,    label: 'Non-stop' },
                        { value: 1,    label: '1 stop' },
                    ] as { value: MaxStops; label: string }[]).map(({ value, label }) => (
                        <Pill
                            key={String(value)}
                            active={filters.maxStops === value}
                            onClick={() => onChange({ maxStops: value })}
                        >
                            {label}
                        </Pill>
                    ))}
                </div>
            </section>

            {/* Price range */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Max price
                    </span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {filters.maxPrice >= effectiveMax ? 'Any' : `≤ ${filters.maxPrice.toLocaleString()}`}
                    </span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={effectiveMax}
                    step={50}
                    value={filters.maxPrice}
                    onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>0</span>
                    <span>{effectiveMax.toLocaleString()}+</span>
                </div>
            </section>
        </div>
    );
}
