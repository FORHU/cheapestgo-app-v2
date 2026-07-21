'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/shared/lib/cn';
import type { FlightOffer } from '@/shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortBy = 'price' | 'duration' | 'departure';
export type MaxStops = null | 0 | 1;

export interface FlightFilterState {
    sortBy: SortBy;
    maxStops: MaxStops;
    refundableOnly: boolean;
    selectedAirlines: string[];
    selectedProviders: string[];
}

export const DEFAULT_FLIGHT_FILTERS: FlightFilterState = {
    sortBy: 'price',
    maxStops: null,
    refundableOnly: false,
    selectedAirlines: [],
    selectedProviders: [],
};

interface FlightFiltersProps {
    filters: FlightFilterState;
    onChange: (f: Partial<FlightFilterState>) => void;
    allOffers?: FlightOffer[];
    className?: string;
}

// ─── Helper: Extract unique airlines from offers ──────────────────────────────

function getAirlines(offers: FlightOffer[]): string[] {
    const set = new Set<string>();
    for (const o of offers) {
        const name = o.segments[0]?.airlineName || o.segments[0]?.airline || o.provider;
        if (name) set.add(name);
    }
    return Array.from(set).sort();
}

// ─── Helper: Extract unique providers from offers ─────────────────────────────

function getProviders(offers: FlightOffer[]): string[] {
    const set = new Set<string>();
    for (const o of offers) {
        if (o.provider) set.add(o.provider);
    }
    return Array.from(set).sort();
}

// ─── FlightFilters ────────────────────────────────────────────────────────────

export function FlightFilters({ filters, onChange, allOffers = [], className }: FlightFiltersProps) {
    const [airlines, setAirlines] = useState<string[]>([]);
    const [providers, setProviders] = useState<string[]>([]);

    useEffect(() => {
        if (allOffers.length > 0) {
            setAirlines(getAirlines(allOffers));
            setProviders(getProviders(allOffers));
        }
    }, [allOffers]);

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {/* Sorting */}
            <div className="space-y-1.5 lg:space-y-2">
                <p className="text-[10px] lg:text-[11px] font-normal text-slate-400 uppercase tracking-widest">Sort by</p>
                <div className="flex flex-col gap-0.5 lg:gap-1">
                    <button
                        onClick={() => onChange({ sortBy: 'price' })}
                        className={cn(
                            'text-left px-3 py-1 lg:py-1.5 rounded-md text-[11px] lg:text-xs font-normal transition-colors',
                            filters.sortBy === 'price'
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                    >
                        Cheapest
                    </button>
                    <button
                        onClick={() => onChange({ sortBy: 'duration' })}
                        className={cn(
                            'text-left px-3 py-1 lg:py-1.5 rounded-md text-[11px] lg:text-xs font-normal transition-colors',
                            filters.sortBy === 'duration'
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                    >
                        Fastest
                    </button>
                    <button
                        onClick={() => onChange({ sortBy: 'departure' })}
                        className={cn(
                            'text-left px-3 py-1 lg:py-1.5 rounded-md text-[11px] lg:text-xs font-normal transition-colors',
                            filters.sortBy === 'departure'
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                    >
                        Earliest Departure
                    </button>
                </div>
            </div>

            {/* Stops */}
            <div className="space-y-1.5 lg:space-y-2">
                <p className="text-[10px] lg:text-[11px] font-normal text-slate-400 uppercase tracking-widest">Stops</p>
                <div className="flex flex-col gap-0.5 lg:gap-1">
                    {([
                        { label: 'Any stops', value: null },
                        { label: 'Non-stop only', value: 0 },
                        { label: 'Up to 1 stop', value: 1 },
                    ] as { label: string; value: MaxStops }[]).map(({ label, value }) => (
                        <button
                            key={label}
                            onClick={() => onChange({ maxStops: value })}
                            className={cn(
                                'text-left px-3 py-1 lg:py-1.5 rounded-md text-[11px] lg:text-xs font-normal transition-colors',
                                filters.maxStops === value
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Fare Type - Refundable Only */}
            <div className="space-y-1.5 lg:space-y-2">
                <p className="text-[10px] lg:text-[11px] font-normal text-slate-400 uppercase tracking-widest">Fare Type</p>
                <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                        <span className="text-[11px] lg:text-xs font-normal text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            Refundable fares only
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Show only fares that can be cancelled for a refund</p>
                    </div>
                    <button
                        role="switch"
                        aria-checked={filters.refundableOnly}
                        onClick={() => onChange({ refundableOnly: !filters.refundableOnly })}
                        className={cn(
                            'relative inline-flex h-4 w-8 shrink-0 rounded-full transition-colors duration-200 focus:outline-none',
                            filters.refundableOnly ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                    >
                        <span
                            className={cn(
                                'inline-block h-3 w-3 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                                filters.refundableOnly ? 'translate-x-4' : 'translate-x-0.5'
                            )}
                        />
                    </button>
                </label>
            </div>

            {/* Provider — dev only */}
            {process.env.NODE_ENV !== 'production' && providers.length > 0 && (
                <div className="space-y-1.5 lg:space-y-2">
                    <p className="text-[10px] lg:text-[11px] font-normal text-slate-400 uppercase tracking-widest">Provider</p>
                    <div className="flex flex-col gap-1">
                        {providers.map((provider) => {
                            const active = filters.selectedProviders.includes(provider);
                            const label = provider === 'mystifly_v2' ? 'Mystifly' : provider;
                            const sub = provider === 'mystifly_v2' ? 'Branded fares' : 'NDC fares';
                            return (
                                <button
                                    key={provider}
                                    onClick={() => {
                                        const next = active
                                            ? filters.selectedProviders.filter((p) => p !== provider)
                                            : [...filters.selectedProviders, provider];
                                        onChange({ selectedProviders: next });
                                    }}
                                    className={cn(
                                        'flex items-center justify-between px-3 py-1 lg:py-1.5 rounded-md text-[11px] lg:text-xs font-normal transition-colors text-left',
                                        active
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-700'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    )}
                                >
                                    <span>{label}</span>
                                    <span className={cn('text-[9px] font-normal', active ? 'text-indigo-400' : 'text-slate-400')}>{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Airlines */}
            {airlines.length > 0 && (
                <div className="space-y-1.5 lg:space-y-2">
                    <p className="text-[10px] lg:text-[11px] font-normal text-slate-400 uppercase tracking-widest">Airlines</p>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                        {airlines.map((airline) => (
                            <label key={airline} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filters.selectedAirlines.includes(airline)}
                                    onChange={() => {
                                        const next = filters.selectedAirlines.includes(airline)
                                            ? filters.selectedAirlines.filter((a) => a !== airline)
                                            : [...filters.selectedAirlines, airline];
                                        onChange({ selectedAirlines: next });
                                    }}
                                    className="w-3 h-3 lg:w-3.5 lg:h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[11px] lg:text-xs font-normal text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                                    {airline}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
