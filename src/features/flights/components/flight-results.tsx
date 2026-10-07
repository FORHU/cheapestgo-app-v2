'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useRef, useEffect } from 'react';
import {  AnimatePresence } from 'framer-motion';
import { Plane, Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import type { FlightOffer } from '@/shared/types';
import { FlightCard } from './flight-card';

const PAGE_SIZE = 15;

/** The card's own shape — plate, itinerary, price column — so nothing moves when results land. */
function FlightCardSkeleton({ index = 0 }: { index?: number }) {
    const bar = 'rounded bg-slate-200 dark:bg-white/10';
    return (
        <div
            className="flex animate-pulse flex-col overflow-hidden rounded-2xl bg-white md:min-h-[205px] md:flex-row dark:bg-slate-900"
            style={{ animationDelay: `${index * 150}ms` }}
        >
            <div className="flex h-20 shrink-0 items-center justify-center md:h-auto md:w-[240px]">
                <div className="size-14 rounded-full bg-slate-200 md:size-[120px] dark:bg-white/10" />
            </div>
            <div className="flex flex-1 flex-col px-5 py-5 md:pt-7 md:pr-8 md:pb-6 md:pl-9">
                <div className={cn(bar, 'h-5 w-40')} />
                <div className={cn(bar, 'mt-2 h-3 w-16')} />
                <div className="mt-[18px] flex items-center gap-5">
                    <div className={cn(bar, 'h-[30px] w-[72px]')} />
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    <div className={cn(bar, 'h-[30px] w-[72px]')} />
                </div>
                <div className="mt-[18px] flex gap-4">
                    <div className={cn(bar, 'h-3.5 w-28')} />
                    <div className={cn(bar, 'h-3.5 w-20')} />
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 md:w-[230px] md:flex-col md:items-stretch md:justify-end md:border-t-0 md:border-l md:p-6 dark:border-white/10">
                <div>
                    <div className={cn(bar, 'h-7 w-32')} />
                    <div className={cn(bar, 'mt-1.5 h-3 w-24')} />
                </div>
                <div className="h-[42px] w-28 rounded-full bg-slate-200 md:mt-4 md:w-full dark:bg-white/10" />
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
    /** The offer whose fare is being checked with the airline right now. */
    checkingOfferId?: string | null;
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
    checkingOfferId = null,
}: FlightResultsProps) {
    const tAll = useTranslations();
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
                        <p className="text-[10px] lg:text-sm font-medium text-slate-700 dark:text-slate-200">{tAll('flights.results.findingFares')}</p>
                        <p className="text-[9px] lg:text-xs text-slate-400 dark:text-slate-500">{tAll('flights.results.checkingProviders')}</p>
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
            <StateScreen
                className={className}
                icon={AlertTriangle}
                title={tAll('flights.results.searchError')}
                lines={[error]}
                actions={onRetry
                    ? <button type="button" onClick={onRetry} className={stateActionClass}>{tAll('flights.results.tryAgain')}</button>
                    : undefined}
            />
        );
    }

    // Empty state
    if (offers.length === 0) {
        return (
            <StateScreen
                className={className}
                icon={Search}
                title={tAll('flights.results.noFlights')}
                lines={[emptyMessage ?? tAll('flights.results.noFlightsBody')]}
            />
        );
    }

    // Results
    return (
        <div className={cn('space-y-4', className)}>
            <AnimatePresence mode="popLayout">
                {visibleOffers.map((offer, idx) => (
                    <FlightCard
                        key={`${offer.offerId}-${idx}`}
                        offer={offer}
                        index={idx}
                        onSelect={onSelect}
                        checkingPrice={checkingOfferId === offer.offerId}
                    />
                ))}
            </AnimatePresence>

            <div ref={sentinelRef} className="h-1 w-full pointer-events-none" />


            {(hasMore || isAutoLoading) && (
                <div className="space-y-4 pb-8">
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
                <p className="pt-4 pb-12 text-center text-[12px] text-slate-400 dark:text-white/40">
                    All {offers.length} {offers.length === 1 ? 'flight' : 'flights'} shown
                </p>
            )}
        </div>
    );
}

export default FlightResults;
