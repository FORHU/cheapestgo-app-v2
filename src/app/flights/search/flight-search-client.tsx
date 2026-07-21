'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, ListFilter, X } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import BackButton from '@/shared/components/common/BackButton';
import { SectionHeader } from '@/shared/components/ui/SectionHeader';
import { GlobalSparkle } from '@/shared/components/ui/GlobalSparkle';
import { http } from '@/shared/lib/http';
import { FlightResults } from '@/features/flights/components/flight-results';
import { FlightFilters, DEFAULT_FLIGHT_FILTERS, type FlightFilterState, type SortBy } from '@/features/flights/components/flight-filters';
import { ResponsiveFlightHeader, ProviderStatus } from '@/features/flights/components/ResponsiveFlightHeader';
import { PriceAlertButton } from '@/features/flights/components/PriceAlertButton';
import type { FlightOffer } from '@/shared/types';

// ─── City name → IATA code lookup ─────────────────────────────────────────────
const CITY_TO_IATA: Record<string, string> = {
    'manila': 'MNL', 'tokyo': 'NRT', 'osaka': 'KIX', 'seoul': 'ICN', 'busan': 'PUS',
    'beijing': 'PEK', 'shanghai': 'PVG', 'hong kong': 'HKG', 'hongkong': 'HKG',
    'taipei': 'TPE', 'singapore': 'SIN', 'bangkok': 'BKK', 'kuala lumpur': 'KUL',
    'kl': 'KUL', 'bali': 'DPS', 'denpasar': 'DPS', 'jakarta': 'CGK',
    'hanoi': 'HAN', 'ho chi minh': 'SGN', 'saigon': 'SGN', 'dubai': 'DXB',
    'abu dhabi': 'AUH', 'doha': 'DOH', 'istanbul': 'IST', 'delhi': 'DEL',
    'new delhi': 'DEL', 'mumbai': 'BOM', 'colombo': 'CMB', 'kathmandu': 'KTM',
    'london': 'LHR', 'paris': 'CDG', 'amsterdam': 'AMS', 'frankfurt': 'FRA',
    'munich': 'MUC', 'berlin': 'BER', 'rome': 'FCO', 'milan': 'MXP',
    'madrid': 'MAD', 'barcelona': 'BCN', 'zurich': 'ZRH', 'vienna': 'VIE',
    'athens': 'ATH', 'lisbon': 'LIS', 'brussels': 'BRU', 'copenhagen': 'CPH',
    'stockholm': 'ARN', 'oslo': 'OSL', 'helsinki': 'HEL', 'prague': 'PRG',
    'warsaw': 'WAW', 'budapest': 'BUD', 'new york': 'JFK', 'nyc': 'JFK',
    'los angeles': 'LAX', 'la': 'LAX', 'san francisco': 'SFO', 'sf': 'SFO',
    'chicago': 'ORD', 'miami': 'MIA', 'toronto': 'YYZ', 'vancouver': 'YVR',
    'cancun': 'CUN', 'mexico city': 'MEX', 'sydney': 'SYD', 'melbourne': 'MEL',
    'auckland': 'AKL', 'da nang': 'DAD', 'danang': 'DAD', 'phu quoc': 'PQC',
};

const IATA_RE = /^[A-Z]{3}$/;

function resolveIATA(input: string): string | null {
    const upper = input.trim().toUpperCase();
    if (IATA_RE.test(upper)) return upper;
    return CITY_TO_IATA[input.trim().toLowerCase()] ?? null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOW_MS = 15_000;
const TIMEOUT_MS = 45_000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchParams {
    origin: string;
    destination: string;
    departure: string;
    returnDate?: string;
    adults: number;
    children: number;
    infants: number;
    cabin: string;
    tripType: string;
}

type SearchStatus =
    | { status: 'loading' }
    | { status: 'loading_slow' }
    | { status: 'success'; offers: FlightOffer[] }
    | { status: 'empty' }
    | { status: 'timeout' }
    | { status: 'error'; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAirlineName(o: FlightOffer): string {
    return o.segments[0]?.airlineName || o.segments[0]?.airline || o.provider;
}

function getAirlines(offers: FlightOffer[]): string[] {
    const set = new Set<string>();
    for (const o of offers) {
        const name = getAirlineName(o);
        if (name) set.add(name);
    }
    return Array.from(set).sort();
}

function getProviderCounts(offers: FlightOffer[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const o of offers) {
        counts[o.provider] = (counts[o.provider] || 0) + 1;
    }
    return counts;
}

// ─── Error / Timeout banners ──────────────────────────────────────────────────

function TimeoutBanner({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-10 text-center space-y-4">
            <div className="text-5xl">⏱️</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Search is taking longer than usual</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Flight providers are responding slowly. Please try again.
            </p>
            <div className="flex gap-3 justify-center mt-2">
                <button
                    onClick={onRetry}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-full transition-colors"
                >
                    Try Again
                </button>
                <Link
                    href="/"
                    className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-semibold rounded-full transition-colors"
                >
                    New Search
                </Link>
            </div>
        </div>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-8 rounded-2xl text-center space-y-3">
            <p className="text-lg font-bold text-red-700 dark:text-red-400">Search Error</p>
            <p className="text-sm text-red-600 dark:text-red-300">{message}</p>
            <Link
                href="/"
                className="block mt-2 text-sm font-semibold text-red-700 dark:text-red-400 hover:underline"
            >
                Try another search
            </Link>
        </div>
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function FlightSearchClient() {
    const sp = useSearchParams();
    const router = useRouter();

    const params: SearchParams = {
        origin:      sp.get('origin') ?? '',
        destination: sp.get('destination') ?? '',
        departure:   sp.get('depart') ?? sp.get('departure') ?? '',
        returnDate:  sp.get('return') ?? undefined,
        adults:      Math.max(1, parseInt(sp.get('adults') ?? '1', 10)),
        children:    Math.max(0, parseInt(sp.get('children') ?? '0', 10)),
        infants:     Math.max(0, parseInt(sp.get('infants') ?? '0', 10)),
        cabin:       sp.get('cabin') ?? 'economy',
        tripType:    sp.get('tripType') ?? (sp.get('return') ? 'round-trip' : 'one-way'),
    };

    const bundleHotelId = sp.get('bundleHotelId');

    const [state, setState] = useState<SearchStatus>({ status: 'loading' });
    const [retryKey, setRetryKey] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    // Filter state
    const [filters, setFilters] = useState<FlightFilterState>(DEFAULT_FLIGHT_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    // allOffers holds the unfiltered list (used to populate the filter panel)
    const [allOffers, setAllOffers] = useState<FlightOffer[]>([]);

    const handleFilterChange = (partial: Partial<FlightFilterState>) => {
        setFilters((prev) => ({ ...prev, ...partial }));
    };

    // Derive offers for filter sidebar airline/provider lists from the unfiltered set
    const airlines = useMemo(() => getAirlines(allOffers.length > 0 ? allOffers : (state.status === 'success' ? state.offers : [])), [allOffers, state]);

    // Client-side filtering
    const rawOffers = state.status === 'success' ? state.offers : [];
    const filteredOffers = useMemo(() => {
        const base = allOffers.length > 0 ? allOffers : rawOffers;
        let offers = [...base];
        if (filters.maxStops !== null) {
            offers = offers.filter((o) => (o.totalStops ?? 0) <= filters.maxStops!);
        }
        if (filters.refundableOnly) {
            offers = offers.filter((o) => (o.farePolicy?.isRefundable ?? o.refundable) === true);
        }
        if (filters.selectedProviders.length > 0) {
            offers = offers.filter((o) => filters.selectedProviders.includes(o.provider));
        }
        if (filters.selectedAirlines.length > 0) {
            offers = offers.filter((o) => {
                const name = getAirlineName(o);
                return filters.selectedAirlines.includes(name);
            });
        }
        if (filters.sortBy === 'price') {
            offers.sort((a, b) => (a.price?.total ?? 0) - (b.price?.total ?? 0));
        } else if (filters.sortBy === 'duration') {
            offers.sort((a, b) => (a.totalDuration ?? 0) - (b.totalDuration ?? 0));
        } else if (filters.sortBy === 'departure') {
            offers.sort((a, b) =>
                new Date(a.segments?.[0]?.departure?.time ?? 0).getTime() -
                new Date(b.segments?.[0]?.departure?.time ?? 0).getTime()
            );
        }
        return offers;
    }, [allOffers, rawOffers, filters]);

    const activeFilterCount = filters.selectedAirlines.length +
        (filters.maxStops !== null ? 1 : 0) +
        (filters.refundableOnly ? 1 : 0) +
        filters.selectedProviders.length;

    const isLoading = state.status === 'loading' || state.status === 'loading_slow';
    const isSlowSearch = state.status === 'loading_slow';

    const handleSelect = useCallback((offer: FlightOffer) => {
        sessionStorage.setItem('selectedFlight', JSON.stringify(offer));
        sessionStorage.setItem('flightSearchPassengers', JSON.stringify({
            adults: params.adults,
            children: params.children,
            infants: params.infants,
        }));
        const qs = new URLSearchParams();
        qs.set('offerId', offer.offerId);
        if (bundleHotelId) {
            qs.set('bundleHotelId', bundleHotelId);
        }
        router.push(`/flights/book?${qs.toString()}`);
    }, [router, params.adults, params.children, params.infants, bundleHotelId]);

    // ─── Search effect ─────────────────────────────────────────────────────────
    useEffect(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setState({ status: 'loading' });

        // Resolve city names to IATA
        const resolvedOrigin = resolveIATA(params.origin);
        const resolvedDestination = resolveIATA(params.destination);

        if (!resolvedOrigin || !resolvedDestination || !params.departure) {
            setState({ status: 'error', message: 'Missing search parameters. Please go back and fill in origin, destination, and departure date.' });
            return;
        }

        const slowId = setTimeout(() => {
            setState((prev) => prev.status === 'loading' ? { status: 'loading_slow' } : prev);
        }, SLOW_MS);

        const timeoutId = setTimeout(() => {
            controller.abort();
            setState({ status: 'timeout' });
        }, TIMEOUT_MS);

        const run = async () => {
            const startTime = Date.now();
            try {
                const body = {
                    origin: resolvedOrigin,
                    destination: resolvedDestination,
                    departureDate: params.departure,
                    returnDate: params.returnDate || null,
                    adults: params.adults,
                    children: params.children,
                    infants: params.infants,
                    cabinClass: params.cabin,
                    tripType: params.tripType,
                };

                const data = await http.post<{ offers: FlightOffer[] }>(
                    '/api/flights/search',
                    body,
                    { signal: controller.signal }
                );

                clearTimeout(timeoutId);
                clearTimeout(slowId);

                // Ensure skeleton is visible for at least 1.5s
                const elapsed = Date.now() - startTime;
                if (elapsed < 1500) {
                    await new Promise((r) => setTimeout(r, 1500 - elapsed));
                }

                const offers = data.offers ?? [];
                setAllOffers(offers);
                setState(offers.length > 0 ? { status: 'success', offers } : { status: 'empty' });
            } catch (err: unknown) {
                clearTimeout(timeoutId);
                clearTimeout(slowId);
                if (err instanceof Error && err.name === 'AbortError') return;
                const msg = err instanceof Error ? err.message : 'Network error';
                setState({ status: 'error', message: msg });
            }
        };

        run();
        return () => {
            clearTimeout(slowId);
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [params.origin, params.destination, params.departure, params.returnDate, params.adults, params.children, params.infants, params.cabin, params.tripType, retryKey]);

    const handleRetry = () => {
        setRetryKey((k) => k + 1);
    };

    const handleSearchEdit = () => {
        router.push('/?mode=flights');
    };

    // ─── Non-result states (full-width, no sidebar) ───────────────────────────
    if (state.status === 'timeout') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <TimeoutBanner onRetry={handleRetry} />
            </div>
        );
    }

    if (state.status === 'error') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <ErrorBanner message={state.message} />
            </div>
        );
    }

    // ─── Mobile filter modal (portal) ─────────────────────────────────────────
    const mobileFilterModal = (
        <AnimatePresence>
            {mobileFiltersOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90] bg-black/40 lg:hidden pointer-events-auto"
                        onClick={() => setMobileFiltersOpen(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: '100%', scale: 1 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 sm:top-[88px] sm:bottom-auto sm:left-auto sm:w-[340px] sm:max-h-[calc(100vh-120px)] max-h-[85vh] z-[100] bg-white dark:bg-slate-900 bg-grid-slate-100 dark:bg-grid-slate-800/50 bg-[length:40px_40px] flex flex-col lg:hidden shadow-2xl rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/50 dark:border-slate-800/50 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Background Sparkles */}
                        <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
                            <GlobalSparkle />
                        </div>

                        {/* Header */}
                        <div className="p-3 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
                            <button
                                onClick={() => setMobileFiltersOpen(false)}
                                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors -ml-1.5"
                            >
                                <X size={16} className="text-slate-700 dark:text-slate-300" />
                            </button>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white absolute left-1/2 -translate-x-1/2">Flight Filters</h2>
                            <div className="w-8" />
                        </div>

                        {/* Filter Content */}
                        <div className="flex-1 overflow-y-auto p-5 relative z-10">
                            <FlightFilters
                                filters={filters}
                                onChange={handleFilterChange}
                                allOffers={allOffers.length > 0 ? allOffers : rawOffers}
                            />
                        </div>

                        {/* Fixed Footer */}
                        <div className="p-4 border-t border-slate-200/50 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-center flex-shrink-0 relative z-10">
                            <button
                                onClick={() => setMobileFiltersOpen(false)}
                                className="w-full max-w-sm py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center transition-transform active:scale-[0.98] shadow-md hover:shadow-lg"
                            >
                                Show {filteredOffers.length} {filteredOffers.length === 1 ? 'flight' : 'flights'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    const cabinLabel = params.cabin.replace('_', ' ');
    const subtitle = [
        params.departure,
        params.returnDate && `↩ ${params.returnDate}`,
        `${params.adults} adult${params.adults !== 1 ? 's' : ''}`,
        cabinLabel,
    ].filter(Boolean).join(' · ');

    return (
        <main className="min-h-screen pt-2 pb-12 px-4 md:pt-6 md:pb-20 overflow-x-hidden bg-slate-50 dark:bg-slate-950">
            <div className="max-w-7xl mx-auto space-y-3 lg:space-y-6">
                {/* Desktop: BackButton + SectionHeader + PriceAlertButton */}
                <div className="hidden lg:block">
                    <BackButton href="/" bareIcon className="mb-1 lg:mb-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center shadow-sm p-0!" />
                    <div className="flex items-start justify-between gap-2 lg:gap-4 flex-wrap">
                        <SectionHeader
                            title={`${params.origin} → ${params.destination}`}
                            subtitle={subtitle}
                            className="!mb-0"
                        />
                        <PriceAlertButton
                            origin={params.origin}
                            destination={params.destination}
                            adults={params.adults}
                            cabin={params.cabin}
                        />
                    </div>

                    {/* Bundle context banner */}
                    {bundleHotelId && (
                        <div className="mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50">
                            <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-lg shrink-0">
                                <Plane size={14} className="text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Flight + Hotel Bundle Active</p>
                                <p className="text-[11px] text-violet-600/80 dark:text-violet-400/80">
                                    Select a flight below — your bundle discount will be applied at checkout.
                                </p>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold bg-amber-400 text-amber-900 rounded-full">
                                Save up to 8%
                            </span>
                        </div>
                    )}
                </div>

                {/* Loading + Results layout */}
                <div className="flex flex-col gap-3 lg:gap-6 relative pb-24 pt-0 lg:pt-0">
                    <ResponsiveFlightHeader
                        origin={params.origin}
                        destination={params.destination}
                        dateStr={params.returnDate ? `${params.departure} — ${params.returnDate}` : params.departure}
                        passengersStr={`${params.adults} adult${params.adults !== 1 ? 's' : ''}${params.children > 0 ? `, ${params.children} child${params.children !== 1 ? 'ren' : ''}` : ''}${params.infants > 0 ? `, ${params.infants} infant${params.infants !== 1 ? 's' : ''}` : ''} · ${cabinLabel}`}
                        activeFilterCount={activeFilterCount}
                        statusElement={<ProviderStatus offers={rawOffers} loading={isLoading} />}
                        resultCount={filteredOffers.length}
                        onFiltersOpen={() => setMobileFiltersOpen(true)}
                        onSearchEdit={handleSearchEdit}
                    />

                    {typeof window !== 'undefined' && createPortal(mobileFilterModal, document.body)}

                    {/* Slow-search warning */}
                    {isSlowSearch && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Still searching&hellip;</p>
                                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Providers are responding slowly. Hang tight.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6 lg:items-start items-stretch">
                        {/* Desktop Sidebar Filters */}
                        <AnimatePresence>
                            {filtersOpen && (
                                <motion.div
                                    initial={{ width: 0, opacity: 0, x: -20 }}
                                    animate={{ width: 288, opacity: 1, x: 0 }}
                                    exit={{ width: 0, opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="hidden lg:block sticky top-24 self-start flex-shrink-0 overflow-hidden"
                                >
                                    <div className="w-full bg-white dark:bg-slate-900 p-6 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <FlightFilters
                                            filters={filters}
                                            onChange={handleFilterChange}
                                            allOffers={allOffers.length > 0 ? allOffers : rawOffers}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex-1 min-w-0 space-y-4">
                            {/* No results after filtering */}
                            {state.status === 'success' && filteredOffers.length === 0 && allOffers.length > 0 ? (
                                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center space-y-3">
                                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300">No flights match your filters</p>
                                    <p className="text-sm text-slate-500">Try adjusting your filter criteria.</p>
                                </div>
                            ) : (
                                <FlightResults
                                    offers={filteredOffers}
                                    loading={isLoading}
                                    onSelect={handleSelect}
                                    skeletonCount={8}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
