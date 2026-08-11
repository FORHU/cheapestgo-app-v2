'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Search } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import type { FlightOffer } from '@/shared/types';
import { FlightCard } from './flight-card';

const PAGE_SIZE = 15;

function FlightCardSkeleton({ index = 0 }: { index?: number }) {
    return (
        <div
            className="flex flex-col lg:flex-row bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-pulse"
            style={{ animationDelay: `${index * 150}ms` }}
        >
            {/* flight info */}
            <div className="flex-1 px-2.5 pt-2.5 pb-2 lg:p-5">
                {/* Airline header */}
                <div className="flex items-center gap-1.5 lg:gap-3 mb-1.5 lg:mb-4">
                    <div className="w-6 h-6 lg:w-10 lg:h-10 rounded-md bg-slate-200 dark:bg-white/10" />
                    <div>
                        <div className="h-3 w-24 lg:h-4 lg:w-[120px] rounded bg-slate-200 dark:bg-white/10 mb-0.5" />
                        <div className="h-2 w-16 lg:h-3 lg:w-20 rounded bg-slate-200 dark:bg-white/10" />
                    </div>
                </div>

                {/* Route timeline */}
                <div className="flex items-center gap-1.5 lg:gap-3 mb-1.5 lg:mb-4">
                    <div className="text-center">
                        <div className="h-4 w-11 lg:h-6 lg:w-14 rounded bg-slate-200 dark:bg-white/10 mb-0.5" />
                        <div className="h-2 w-6 lg:h-3 lg:w-8 rounded bg-slate-200 dark:bg-white/10" />
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="h-2 w-9 lg:h-3 lg:w-12 rounded bg-slate-200 dark:bg-white/10" />
                        <div className="w-full h-[2px] rounded bg-slate-200 dark:bg-white/10" />
                        <div className="h-2 w-10 lg:h-3 lg:w-[52px] rounded bg-slate-200 dark:bg-white/10" />
                    </div>
                    <div className="text-center">
                        <div className="h-4 w-11 lg:h-6 lg:w-14 rounded bg-slate-200 dark:bg-white/10 mb-0.5" />
                        <div className="h-2 w-6 lg:h-3 lg:w-8 rounded bg-slate-200 dark:bg-white/10" />
                    </div>
                </div>

                {/* Tags */}
                <div className="flex gap-0.5 lg:gap-2">
                    <div className="h-3.5 w-[50px] lg:h-[22px] lg:w-20 rounded-full bg-slate-200 dark:bg-white/10" />
                    <div className="h-3.5 w-11 lg:h-[22px] lg:w-[72px] rounded-full bg-slate-200 dark:bg-white/10" />
                    <div className="h-3.5 w-[38px] lg:h-[22px] lg:w-16 rounded-full bg-slate-200 dark:bg-white/10" />
                </div>
            </div>

            {/* price */}
            <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-1.5 lg:gap-2 lg:w-[180px] px-2.5 py-2 lg:p-5 lg:border-l border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                <div>
                    <div className="h-5 w-[70px] lg:h-7 lg:w-[100px] rounded bg-slate-200 dark:bg-white/10 mb-0.5" />
                    <div className="h-2.5 w-[50px] lg:h-3.5 lg:w-[72px] rounded bg-slate-200 dark:bg-white/10" />
                </div>
                <div className="h-7 w-[76px] lg:h-[38px] lg:w-full rounded-full lg:rounded-lg bg-slate-200 dark:bg-white/10" />
            </div>
        </div>
    );
}

interface FlightResultsProps {
    offers: FlightOffer[];
    loading: boolean;
    error?: string | null;
    onSelect?: (offer: FlightOffer) => void;
    onRetry?: () => void;
    skeletonCount?: number;
    emptyMessage?: string;
    className?: string;
}

export function FlightResults({
    offers,
    loading,
    error = null,
    onSelect,
    onRetry,
    skeletonCount = 5,
    emptyMessage,
    className,
}: FlightResultsProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [isAutoLoading, setIsAutoLoading] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [offers]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && offers.length > visibleCount && !isAutoLoading) {
                    setIsAutoLoading(true);
                    setTimeout(() => {
                        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, offers.length));
                        setIsAutoLoading(false);
                    }, 1200);
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [offers.length, visibleCount, isAutoLoading]);

    const visibleOffers = offers.slice(0, visibleCount);
    const hasMore = offers.length > visibleCount;

    // Loading state
    if (loading) {
        return (
            <div className={cn('space-y-3', className)}>
                {/* Animated header */}
                <div className="flex items-center justify-center gap-2 lg:gap-3 py-2 lg:py-4">
                    <div className="relative">
                        <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <Plane className="w-4 h-4 lg:w-6 lg:h-6 text-indigo-500 animate-pulse" />
                        </div>
                        <div className="absolute inset-0 w-8 h-8 lg:w-12 lg:h-12 border-2 lg:border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div>
                        <p className="text-[10px] lg:text-sm font-medium text-slate-700 dark:text-slate-200">Finding the best fares&hellip;</p>
                        <p className="text-[9px] lg:text-xs text-slate-400 dark:text-slate-500">Checking multiple providers</p>
                    </div>
                </div>

                {/* Skeleton cards */}
                {Array.from({ length: skeletonCount }).map((_, i) => (
                    <FlightCardSkeleton key={i} index={i} />
                ))}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={cn('flex flex-col items-center justify-center py-8 lg:py-16 gap-2 lg:gap-4', className)}>
                <div className="w-9 h-9 lg:w-14 lg:h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-4.5 h-4.5 lg:w-7 lg:h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <div className="text-center">
                    <h3 className="text-xs lg:text-lg font-semibold text-slate-800 dark:text-slate-200">Search Error</h3>
                    <p className="text-[10px] lg:text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm">{error}</p>
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-1 px-4 lg:px-6 py-1.5 lg:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-[10px] lg:text-sm transition-colors"
                    >
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    // Empty state
    if (offers.length === 0) {
        return (
            <div className={cn('flex flex-col items-center justify-center py-8 lg:py-16 gap-2 lg:gap-4', className)}>
                <div className="w-9 h-9 lg:w-14 lg:h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Search className="w-4.5 h-4.5 lg:w-7 lg:h-7 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="text-center">
                    <h3 className="text-xs lg:text-lg font-semibold text-slate-700 dark:text-slate-300">No flights found</h3>
                    <p className="text-[10px] lg:text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm">{emptyMessage ?? 'Try adjusting your search dates or nearby airports.'}</p>
                </div>
            </div>
        );
    }

    // Results
    return (
        <div className={cn('space-y-3', className)}>
            <AnimatePresence mode="popLayout">
                {visibleOffers.map((offer, idx) => (
                    <FlightCard
                        key={`${offer.offerId}-${idx}`}
                        offer={offer}
                        index={idx}
                        onSelect={onSelect}
                    />
                ))}
            </AnimatePresence>

            <div ref={sentinelRef} className="h-1 w-full pointer-events-none" />


            {(hasMore || isAutoLoading) && (
                <div className="space-y-3 pb-8">
                    <FlightCardSkeleton index={0} />
                    <FlightCardSkeleton index={1} />
                    <FlightCardSkeleton index={2} />
                    <div className="flex flex-col items-center gap-2 py-4">
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 animate-pulse">
                            <div className="w-1 h-1 rounded-full bg-indigo-500" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">
                                Discovering more ({visibleOffers.length} / {offers.length})
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!hasMore && !isAutoLoading && offers.length > 0 && (
                <div className="pt-4 pb-12 text-center">
                    <p className="text-[10px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-60">
                        All {offers.length} flights shown
                    </p>
                </div>
            )}
        </div>
    );
}

export default FlightResults;
