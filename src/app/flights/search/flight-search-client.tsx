'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plane, Search, AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/shared/components/header';
import { Button } from '@/shared/components/ui/button';
import { http } from '@/shared/lib/http';
import { FlightResults } from '@/features/flights/components/flight-results';
import type { FlightOffer } from '@/shared/types';

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

// ─── Compact Search Bar ───────────────────────────────────────────────────────

function CompactSearchBar({ params }: { params: SearchParams }) {
    const router = useRouter();

    const handleModify = () => {
        // Navigate back to home with flights tab active
        router.push('/?mode=flights');
    };

    const passengers = params.adults + params.children + params.infants;

    return (
        <div className="sticky top-14 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
                <Link
                    href="/"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
                    aria-label="Back"
                >
                    <ArrowLeft size={16} className="text-slate-600 dark:text-slate-400" />
                </Link>

                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Plane size={13} className="text-blue-500 shrink-0" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {params.origin}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 text-sm">→</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {params.destination}
                        </span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span>{params.departure}</span>
                        {params.returnDate && (
                            <>
                                <span>—</span>
                                <span>{params.returnDate}</span>
                            </>
                        )}
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span>
                            {passengers} passenger{passengers !== 1 ? 's' : ''}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span className="capitalize">{params.cabin.replace('_', ' ')}</span>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleModify}
                    className="shrink-0 gap-1.5 text-xs"
                >
                    <Search size={12} />
                    Modify
                </Button>
            </div>
        </div>
    );
}

// ─── Error / Timeout banners ──────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-8 text-center space-y-3">
            <AlertCircle className="mx-auto text-rose-500" size={32} />
            <h3 className="text-base font-semibold text-rose-700 dark:text-rose-400">Search failed</h3>
            <p className="text-sm text-rose-600 dark:text-rose-300 max-w-sm mx-auto">{message}</p>
            <Button
                size="sm"
                variant="destructive"
                onClick={onRetry}
                className="gap-1.5"
            >
                <RotateCcw size={13} />
                Try again
            </Button>
        </div>
    );
}

function TimeoutBanner({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Plane className="text-amber-500" size={24} />
            </div>
            <h3 className="text-base font-semibold text-amber-700 dark:text-amber-400">
                Search is taking longer than usual
            </h3>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 max-w-sm mx-auto">
                Flight providers are responding slowly. Please try again.
            </p>
            <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={onRetry} className="gap-1.5 bg-amber-500 hover:bg-amber-600">
                    <RotateCcw size={13} />
                    Try again
                </Button>
                <Link href="/">
                    <Button size="sm" variant="outline">
                        New search
                    </Button>
                </Link>
            </div>
        </div>
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function FlightSearchClient() {
    const sp = useSearchParams();

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

    const [state, setState] = useState<SearchStatus>({ status: 'loading' });
    const [retryKey, setRetryKey] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    const runSearch = useCallback(async () => {
        if (!params.origin || !params.destination || !params.departure) {
            setState({ status: 'error', message: 'Missing search parameters. Please go back and fill in origin, destination, and departure date.' });
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setState({ status: 'loading' });

        const slowId = setTimeout(() => {
            setState((prev) => prev.status === 'loading' ? { status: 'loading_slow' } : prev);
        }, SLOW_MS);

        const timeoutId = setTimeout(() => {
            controller.abort();
            setState({ status: 'timeout' });
        }, TIMEOUT_MS);

        try {
            const segments = [{ origin: params.origin, destination: params.destination, date: params.departure }];
            if (params.tripType === 'round-trip' && params.returnDate) {
                segments.push({ origin: params.destination, destination: params.origin, date: params.returnDate });
            }

            const body = {
                segments,
                passengers: {
                    adults:   params.adults,
                    children: params.children,
                    infants:  params.infants,
                },
                cabinClass: params.cabin,
                tripType:   params.tripType,
            };

            const startTime = Date.now();

            const data = await http.post<{ offers: FlightOffer[] }>(
                '/api/flights/search',
                body,
                { signal: controller.signal }
            );

            clearTimeout(slowId);
            clearTimeout(timeoutId);

            // Ensure skeleton is visible for at least 1.5s
            const elapsed = Date.now() - startTime;
            if (elapsed < 1500) {
                await new Promise((r) => setTimeout(r, 1500 - elapsed));
            }

            const offers = data.offers ?? [];
            setState(offers.length > 0 ? { status: 'success', offers } : { status: 'empty' });
        } catch (err: unknown) {
            clearTimeout(slowId);
            clearTimeout(timeoutId);
            if (err instanceof Error && err.name === 'AbortError') return;
            const msg = err instanceof Error ? err.message : 'Network error';
            setState({ status: 'error', message: msg });
        }
    }, [params.origin, params.destination, params.departure, params.returnDate, params.adults, params.children, params.infants, params.cabin, params.tripType, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        runSearch();
        return () => {
            abortRef.current?.abort();
        };
    }, [runSearch]);

    const handleRetry = () => setRetryKey((k) => k + 1);

    const isLoading = state.status === 'loading' || state.status === 'loading_slow';
    const isSlowSearch = state.status === 'loading_slow';

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <CompactSearchBar params={params} />

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
                {/* Page heading */}
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                        {params.origin} → {params.destination}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {params.departure}
                        {params.returnDate && ` — ${params.returnDate}`}
                        {' · '}
                        {params.adults} adult{params.adults !== 1 ? 's' : ''}
                        {params.children > 0 && `, ${params.children} child${params.children !== 1 ? 'ren' : ''}`}
                        {params.infants > 0 && `, ${params.infants} infant${params.infants !== 1 ? 's' : ''}`}
                        {' · '}
                        <span className="capitalize">{params.cabin.replace('_', ' ')}</span>
                    </p>
                </div>

                {/* Slow-search warning banner */}
                {isSlowSearch && (
                    <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Still searching…</p>
                            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                                Providers are responding slowly. Hang tight.
                            </p>
                        </div>
                    </div>
                )}

                {/* Error / timeout states */}
                {state.status === 'error' && (
                    <ErrorBanner message={state.message} onRetry={handleRetry} />
                )}
                {state.status === 'timeout' && (
                    <TimeoutBanner onRetry={handleRetry} />
                )}

                {/* Results (or skeleton while loading) */}
                {(isLoading || state.status === 'success' || state.status === 'empty') && (
                    <FlightResults
                        offers={state.status === 'success' ? state.offers : []}
                        loading={isLoading}
                        adults={params.adults}
                    />
                )}
            </main>
        </div>
    );
}
