'use client';

import React from 'react';
import { Plane, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { FlightOffer } from '@/shared/types';

interface ProviderStatusProps {
    offers: FlightOffer[];
    loading: boolean;
}

export function ProviderStatus({ offers, loading }: ProviderStatusProps) {
    const providerCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const o of offers) {
            counts[o.provider] = (counts[o.provider] || 0) + 1;
        }
        return counts;
    }, [offers]);

    const entries = Object.entries(providerCounts);

    if (loading) {
        return (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Fetching providers...
                </span>
            </div>
        );
    }

    if (entries.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-normal">
            <span className="text-blue-600 dark:text-blue-400">Sources:</span>
            {entries.map(([provider, count]) => (
                <span
                    key={provider}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {provider}: {count}
                </span>
            ))}
            <span className="text-slate-400">
                Total: {offers.length}
            </span>
        </div>
    );
}

interface ResponsiveFlightHeaderProps {
    origin: string;
    destination: string;
    dateStr: string;
    passengersStr: string;
    activeFilterCount: number;
    statusElement?: React.ReactNode;
    resultCount?: number;
    onFiltersOpen: () => void;
    onSearchEdit: () => void;
    className?: string;
}

export function ResponsiveFlightHeader({
    origin,
    destination,
    dateStr,
    passengersStr,
    activeFilterCount,
    statusElement,
    resultCount,
    onFiltersOpen,
    onSearchEdit,
    className,
}: ResponsiveFlightHeaderProps) {
    return (
        <>
            {/* Mobile: header */}
            <div className="lg:hidden sticky top-[14px] z-40 w-full py-1">
                <div className="flex flex-col gap-2 w-full bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-4 shadow-lg ring-1 ring-black/5">
                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={onSearchEdit}
                            className="flex-1 flex flex-col items-start justify-center min-w-0 pr-3"
                        >
                            <span className="text-[13px] font-normal text-blue-600 dark:text-blue-400 truncate w-full text-left">
                                {origin} → {destination}
                            </span>
                            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate w-full text-left">
                                {dateStr} • {passengersStr}
                            </span>
                        </button>

                        <button
                            onClick={onFiltersOpen}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0 relative"
                        >
                            <SlidersHorizontal size={18} className="text-slate-600 dark:text-slate-400" />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white border-2 border-white dark:border-slate-900">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {(statusElement || resultCount != null) && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">{statusElement}</div>
                            {resultCount != null && (
                                <span className="text-[11px] font-normal text-slate-400 shrink-0">
                                    {resultCount} {resultCount === 1 ? 'flight' : 'flights'}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
