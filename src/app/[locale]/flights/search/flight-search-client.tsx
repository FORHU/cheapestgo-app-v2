'use client';

import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, X, CalendarClock, Clock, SearchX, SlidersHorizontal } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createPortal } from 'react-dom';
import { StateScreen, stateActionClass, stateSecondaryClass } from '@/shared/components/StateScreen';
import { Button } from '@/shared/components/ui/button';
import { useTheme } from '@/shared/components/ThemeContext';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { BRAND, brandTheme } from '@/shared/lib/palette';
import { SHELL_CAP, SHELL_GUTTER } from '@/shared/lib/layout';
import { resolveDepartureDate } from '@/features/landing/lib/links';
import { FlightResults } from '@/features/flights/components/flight-results';
import { FlightFilters } from '@/features/flights/components/flight-filters';
import { FlightSearchTopBar } from '@/features/flights/components/flight-search-top-bar';
import { PriceAlertButton } from '@/features/flights/components/PriceAlertButton';
import {
    DEFAULT_FLIGHT_FILTERS, activeFilterCount as countActiveFilters, applyFlightFilters, type FlightFilterState,
} from '@/features/flights/lib/filter-offers';
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

/**
 * An airport code, from whatever the URL happens to carry.
 *
 * Three shapes reach here, and only two were handled. The bare code comes from a deep
 * link; a bare city name comes from the landing page's curated links; and **"Clark (CRK)"**
 * comes from the search bar, which puts the airport picker's own display name in the URL
 * (`immersive-search-bar.tsx`, `origin: pickedOrigin?.name`).
 *
 * That third shape matched neither test, so every flight search started from the app's own
 * search bar refused with "tell us where you are flying from and to" — the one route into
 * the feature, closed. Deep links kept working, which is why it survived.
 *
 * The parenthesised code is read first: when a name carries one it is the authority, and
 * "London (LHR)" should not be able to resolve through the city table to anywhere else.
 */
function resolveIATA(input: string): string | null {
    const trimmed = input.trim();
    const upper = trimmed.toUpperCase();
    if (IATA_RE.test(upper)) return upper;

    const tagged = /\(([A-Z]{3})\)/.exec(upper);
    if (tagged) return tagged[1];

    return CITY_TO_IATA[trimmed.toLowerCase()] ?? null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOW_MS = 15_000;
const TIMEOUT_MS = 45_000;

/**
 * The sidebar's motion, as the hotel results page has it (`hotel-results.tsx`):
 * the panel's width, the width of the column once it is only the handle, the
 * spring the column and the results share, and the panel's own quicker fade.
 */
const PANEL_W = 280;
const HANDLE_W = 42;
const FILTER_SLIDE = { type: 'spring' as const, damping: 30, stiffness: 260, mass: 0.7 };
const PANEL_FADE = { duration: 0.18 };

/**
 * The page ground — slate-100, as the hotel list view has it, or the landing canvas in the dark — painted on the
 * app shell by `body.flat-ground` (globals.css) in place of v1's graph paper.
 *
 * The sticky bar's strip paints the same ground so the bar floats on it rather than
 * on a band of its own. Dark is held to the viewport, as the shell's is, so the strip
 * shows exactly the slice of the glow behind it.
 */
const GROUND: Record<'light' | 'dark', React.CSSProperties> = {
    light: { background: '#f1f5f9' },
    dark:  { backgroundColor: BRAND.obsidian, backgroundImage: BRAND.canvas, backgroundAttachment: 'fixed' },
};

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

// ─── Error / Timeout banners ──────────────────────────────────────────────────

function TimeoutBanner({ onRetry }: { onRetry: () => void }) {
    const tAll = useTranslations();
    return (
        <StateScreen
            icon={Clock}
            title={tAll('flights.results.slowTitle')}
            lines={[tAll('flights.results.slowBody')]}
            actions={
                <>
                    <button type="button" onClick={onRetry} className={stateActionClass}>
                        {tAll('flights.results.tryAgain')}
                    </button>
                    <Link href="/" className={stateSecondaryClass}>
                        {tAll('flights.results.newSearch')}
                    </Link>
                </>
            }
        />
    );
}

function ErrorBanner({ message }: { message: string }) {
    const tAll = useTranslations();
    return (
        <StateScreen
            icon={SearchX}
            title={tAll('flights.results.searchError')}
            lines={[message]}
            actions={
                <Link href="/" className={stateActionClass}>
                    {tAll('flights.results.tryAnother')}
                </Link>
            }
        />
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function FlightSearchClient() {
    const tAll = useTranslations();
    const sp = useSearchParams();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();

    // v1's graph paper and sparkles live on the app shell, out of this page's
    // reach; the body class swaps them for the plain ground. See `GROUND`.
    useEffect(() => {
        document.body.classList.add('flat-ground');
        return () => document.body.classList.remove('flat-ground');
    }, []);

    // A route can be named without a date, and a link can sit in a chat window until its
    // date has gone. Neither is worth refusing to search over — the airline rejects a past
    // departure, and the page then reads as though the route has no flights at all.
    const { departure: resolvedDeparture, chosen: departureChosen } = resolveDepartureDate(
        sp.get('depart') ?? sp.get('departure'),
    );

    const params: SearchParams = {
        origin: sp.get('origin') ?? '',
        destination: sp.get('destination') ?? '',
        departure: resolvedDeparture,
        returnDate: sp.get('return') ?? undefined,
        adults: Math.max(1, parseInt(sp.get('adults') ?? '1', 10)),
        children: Math.max(0, parseInt(sp.get('children') ?? '0', 10)),
        infants: Math.max(0, parseInt(sp.get('infants') ?? '0', 10)),
        cabin: sp.get('cabin') ?? 'economy',
        tripType: sp.get('tripType') ?? (sp.get('return') ? 'round-trip' : 'one-way'),
    };

    const bundleHotelId = sp.get('bundleHotelId');

    const [state, setState] = useState<SearchStatus>({ status: 'loading' });
    const [retryKey, setRetryKey] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    // Filter state
    const [filters, setFilters] = useState<FlightFilterState>(DEFAULT_FLIGHT_FILTERS);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    // allOffers holds the unfiltered list (used to populate the filter panel)
    const [allOffers, setAllOffers] = useState<FlightOffer[]>([]);

    const handleFilterChange = (partial: Partial<FlightFilterState>) => {
        setFilters((prev) => ({ ...prev, ...partial }));
    };
    const resetFilters = () => setFilters(DEFAULT_FLIGHT_FILTERS);

    // Client-side filtering — v1's rules, in `lib/filter-offers.ts`.
    // Memoised so the empty-state array keeps its identity across renders —
    // otherwise it invalidates the `filteredOffers` memo below on every render.
    const rawOffers = useMemo(() => (state.status === 'success' ? state.offers : []), [state]);
    const filteredOffers = useMemo(
        () => applyFlightFilters(allOffers.length > 0 ? allOffers : rawOffers, filters),
        [allOffers, rawOffers, filters],
    );
    const activeFilterCount = countActiveFilters(filters);

    const isLoading = state.status === 'loading' || state.status === 'loading_slow';
    const isSlowSearch = state.status === 'loading_slow';

    /**
     * Check the fare is still what it says before sending anyone to pay for it.
     *
     * An airline fare moves between the search and the booking. Without this the traveller
     * finds out at the moment the order is placed — card details in, nothing to decide.
     * Asking first turns it into a question: this fare went up, still want it? A fare that
     * has gone *down* is taken silently at the lower price, and a provider that cannot
     * answer never blocks the booking.
     */
    const [revalidating, setRevalidating] = useState<string | null>(null);

    const handleSelect = useCallback(async (offer: FlightOffer) => {
        let chosen = offer;
        try {
            setRevalidating(offer.offerId);
            const check = await http.post<{ priceChanged?: boolean; newPrice?: number }>(
                '/api/flights/revalidate',
                { provider: offer.provider, flightPayload: offer },
            );

            if (check.priceChanged && typeof check.newPrice === 'number') {
                const currency = offer.price?.currency ?? '';
                const ok = window.confirm(
                    `The price for this flight has changed to ${currency} ${check.newPrice.toLocaleString()}.`
                    + '\n\nContinue at the new price?',
                );
                if (!ok) return;
            }
            if (typeof check.newPrice === 'number' && check.newPrice > 0) {
                // Including a drop: the booking charges what the supplier now quotes, so the
                // checkout has to show that rather than the figure from the search.
                chosen = { ...offer, price: { ...offer.price, total: check.newPrice } };
            }
        } catch {
            // The order path re-quotes and surfaces the real error; a failed check here is
            // not a reason to stop someone booking.
        } finally {
            setRevalidating(null);
        }

        sessionStorage.setItem('selectedFlight', JSON.stringify(chosen));
        sessionStorage.setItem('flightSearchPassengers', JSON.stringify({
            adults: params.adults,
            children: params.children,
            infants: params.infants,
        }));
        const qs = new URLSearchParams();
        qs.set('offerId', chosen.offerId);
        // Checkout reads the trip from the URL, never from sessionStorage, so with the
        // offer id alone it drew an empty route and a USD 0 total. The server still
        // prices the booking from the offer; these are what the page shows meanwhile.
        const first = chosen.segments?.[0];
        const last  = chosen.segments?.[chosen.segments.length - 1];
        qs.set('totalAmount', String(chosen.price?.total ?? 0));
        qs.set('currency', chosen.price?.currency ?? 'USD');
        if (first?.origin)                    qs.set('origin', first.origin);
        if (last?.destination)                qs.set('destination', last.destination);
        if (first?.departure?.time)           qs.set('departureDate', first.departure.time.slice(0, 10));
        if (first?.cabinClass)                qs.set('cabin', first.cabinClass);
        qs.set('adults', String(params.adults));
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
        // The last route's offers would otherwise fill the filter panel — its airlines,
        // its prices — until this one answers.
        setAllOffers([]);

        // Resolve city names to IATA
        const resolvedOrigin = resolveIATA(params.origin);
        const resolvedDestination = resolveIATA(params.destination);

        // The date is always resolvable; a route is not. Nothing can guess where someone
        // meant to fly, so that is the only case left worth refusing.
        if (!resolvedOrigin || !resolvedDestination) {
            setState({ status: 'error', message: tAll('flights.results.missingRoute') });
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

                const data = await http.post<{ offers: FlightOffer[]; providersFailed?: boolean; failedProviders?: string[] }>(
                    '/api/flights/search',
                    body,
                    { signal: controller.signal }
                );

                clearTimeout(timeoutId);
                clearTimeout(slowId);

                const elapsed = Date.now() - startTime;
                if (elapsed < 1500) {
                    await new Promise((r) => setTimeout(r, 1500 - elapsed));
                }

                const offers = data.offers ?? [];
                setAllOffers(offers);
                // No offers because an airline's system could not answer is not the same as no
                // flights on the route. Shown as "no flights found", an outage reads as a fact
                // about the route and leaves the traveller nothing to do; the error state has a
                // retry.
                if (offers.length === 0 && data.providersFailed) {
                    setState({
                        status: 'error',
                        message: 'We could not reach the airlines just now. Your search has not been run — please try again.',
                    });
                } else {
                    setState(offers.length > 0 ? { status: 'success', offers } : { status: 'empty' });
                }
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

    /**
     * A change made on the top bar — route, dates, travellers or cabin — as a new
     * search URL, in the shape the landing search writes. The filters start over
     * with it: an airline or price picked for one route means nothing on another.
     */
    const applySearch = (next: Partial<SearchParams>) => {
        const merged = { ...params, ...next };
        const qs = new URLSearchParams({
            origin:      merged.origin,
            destination: merged.destination,
            depart:      merged.departure,
            tripType:    merged.returnDate ? 'round-trip' : 'one-way',
            cabin:       merged.cabin,
            adults:      String(merged.adults),
            children:    String(merged.children),
            infants:     String(merged.infants),
        });
        if (merged.returnDate) qs.set('return', merged.returnDate);
        if (bundleHotelId) qs.set('bundleHotelId', bundleHotelId);
        setFilters(DEFAULT_FLIGHT_FILTERS);
        router.push(`/flights/search?${qs.toString()}`);
    };

    const panelProps = {
        filters,
        onChange: handleFilterChange,
        onReset: resetFilters,
        allOffers: allOffers.length > 0 ? allOffers : rawOffers,
    };

    // The hotel results page's drawer, so filters open the same way on both: the
    // scrim fades and the sheet slides in from the right edge and back out of it.
    const mobileFilterModal = (
        <AnimatePresence>
            {mobileFiltersOpen && (
                <motion.div
                    key="filter-drawer"
                    className="fixed inset-0 z-[100] flex lg:hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileFiltersOpen(false)}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={FILTER_SLIDE}
                        className="no-scrollbar relative ml-auto h-full w-[320px] max-w-full overflow-y-auto bg-slate-50 p-4 dark:bg-[#020617]"
                    >
                        <div className="mb-3 flex items-center justify-end">
                            <button onClick={() => setMobileFiltersOpen(false)} aria-label={tAll('hotels.filters.close')}>
                                <X size={18} className="text-slate-500 dark:text-white/60" />
                            </button>
                        </div>
                        <FlightFilters {...panelProps} />
                        <Button fullWidth className="mt-6" onClick={() => setMobileFiltersOpen(false)}>
                            Show {filteredOffers.length} {filteredOffers.length === 1 ? 'flight' : 'flights'}
                        </Button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // "Seoul (ICN)" from the search bar reads as "Seoul" in "Flights to …"; a bare code stays a code.
    const destinationCity = params.destination.replace(/\s*\([A-Z]{3}\)\s*$/, '') || params.destination;

    const failed = state.status === 'timeout' || state.status === 'error';

    return (
        <>
            {/* ── Top bar ──────────────────────────────────────────────────────
                The hotel search page's bar, flights' version, standing in for the
                app header as it does there. Sticky on the page ground so the
                cards scroll under it rather than through the gap around it. Drawn
                in every state — after an error it is the only way to change the
                search without starting over. */}
            <div className={cn('sticky top-0 z-30 pt-4 pb-3', SHELL_GUTTER)} style={GROUND[theme]}>
                <div className={cn('relative', SHELL_CAP)}>
                    <FlightSearchTopBar
                        tone={theme}
                        barBackground={brandTheme(theme).surface}
                        onBack={() => router.back()}
                        route={{
                            origin: params.origin,
                            destination: params.destination,
                            onApply: (next) => applySearch(next),
                        }}
                        searching={isLoading}
                        trip={{
                            departure: params.departure,
                            returnDate: params.returnDate,
                            adults: params.adults,
                            children: params.children,
                            infants: params.infants,
                            cabin: params.cabin,
                            onApply: (next) => applySearch(next),
                        }}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                        // The sidebar is the filter surface once there is room for it.
                        filters={{
                            open: mobileFiltersOpen,
                            activeCount: activeFilterCount,
                            onToggle: () => setMobileFiltersOpen((v) => !v),
                            mobileOnly: true,
                        }}
                    />

                    {/* A date nobody asked for is disclosed, never applied quietly —
                        the traveller named a route, so they are told which day they
                        are being quoted for and that moving it is how to see others. */}
                    {!departureChosen && (
                        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-white/55">
                            <CalendarClock size={12} className="shrink-0 text-blue-500" aria-hidden />
                            {tAll('flights.results.datePicked')}
                        </p>
                    )}
                </div>
            </div>

            {typeof window !== 'undefined' && createPortal(mobileFilterModal, document.body)}

            <main className={cn('flex-1 pt-3 pb-24 md:pb-28', SHELL_GUTTER)}>
                <div className={cn('w-full', SHELL_CAP)}>
                    {state.status === 'timeout' && (
                        <div className="flex justify-center py-10"><TimeoutBanner onRetry={handleRetry} /></div>
                    )}
                    {state.status === 'error' && (
                        <div className="flex justify-center py-10"><ErrorBanner message={state.message} /></div>
                    )}

                    {!failed && (
                        <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
                            {/* Desktop sidebar. The column is what animates: the results
                                are `flex-1` off it, so its width carries them across. Not
                                clipped, because the panel's collapse handle straddles its
                                right edge — see `hotel-results.tsx`, which this mirrors.
                                Stretched to the results' height: sized to the panel alone,
                                the column left the sticky panel no room to stay put in, and
                                it scrolled away with the page. */}
                            <motion.div
                                className="relative hidden shrink-0 self-stretch lg:block"
                                initial={false}
                                animate={{ width: filtersCollapsed ? HANDLE_W : PANEL_W }}
                                transition={FILTER_SLIDE}
                            >
                                <div className="sticky top-24">
                                    <AnimatePresence initial={false} mode="wait">
                                        {filtersCollapsed ? (
                                            <motion.button
                                                key="show-filters"
                                                type="button"
                                                onClick={() => setFiltersCollapsed(false)}
                                                aria-label={tAll('hotels.filters.show')}
                                                title={tAll('hotels.filters.show')}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={PANEL_FADE}
                                                className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-slate-300/90 text-slate-800 transition-opacity hover:opacity-85 dark:bg-white/25 dark:text-white"
                                            >
                                                <SlidersHorizontal size={19} strokeWidth={1.75} />
                                            </motion.button>
                                        ) : (
                                            <motion.div
                                                key="filters"
                                                initial={{ opacity: 0, x: -14 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -14 }}
                                                transition={PANEL_FADE}
                                                style={{ width: PANEL_W }}
                                            >
                                                <FlightFilters {...panelProps} onCollapse={() => setFiltersCollapsed(true)} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>

                            <div className="min-w-0 flex-1">
                                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h1 className="text-lg font-bold text-slate-900 md:text-2xl dark:text-slate-50">
                                            {tAll('flights.results.flightsTo', { city: destinationCity })}
                                        </h1>
                                        <p className="mt-0.5 text-xs text-slate-500 md:text-sm dark:text-white/55">
                                            {isLoading
                                                ? tAll('flights.results.findingFares')
                                                : tAll('flights.results.flightsFound', { count: filteredOffers.length })}
                                        </p>
                                    </div>
                                    <PriceAlertButton
                                        origin={params.origin}
                                        destination={params.destination}
                                        adults={params.adults}
                                        cabin={params.cabin}
                                    />
                                </div>

                                {bundleHotelId && (
                                    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 dark:border-violet-700/50 dark:bg-violet-900/20">
                                        <div className="shrink-0 rounded-lg bg-violet-100 p-1.5 dark:bg-violet-900/40">
                                            <Plane size={14} className="text-violet-600 dark:text-violet-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">{tAll('flights.results.bundleActive')}</p>
                                            <p className="text-[11px] text-violet-600/80 dark:text-violet-400/80">
                                                {tAll('flights.results.bundleBody')}
                                            </p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                            {tAll('flights.results.saveUpTo')}
                                        </span>
                                    </div>
                                )}

                                {isSlowSearch && (
                                    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950/30">
                                        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Still searching&hellip;</p>
                                            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">{tAll('flights.results.slowHint')}</p>
                                        </div>
                                    </div>
                                )}

                                {revalidating && (
                                    <div role="status" className="mb-4 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600 dark:bg-white/8 dark:text-white/70">
                                        {tAll('flights.results.checkingFare')}
                                    </div>
                                )}

                                {state.status === 'success' && filteredOffers.length === 0 && allOffers.length > 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center dark:border-white/10 dark:bg-slate-900">
                                        <h3 className="font-medium text-slate-900 dark:text-white">{tAll('flights.results.noMatch')}</h3>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">{tAll('flights.results.noMatchHint')}</p>
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="mt-3 text-xs text-slate-600 underline underline-offset-2 dark:text-white/70"
                                        >
                                            {tAll('flights.results.clearFilters')}
                                        </button>
                                    </div>
                                ) : (
                                    <FlightResults
                                        offers={filteredOffers}
                                        loading={isLoading}
                                        onSelect={handleSelect}
                                        checkingOfferId={revalidating}
                                        skeletonCount={8}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
