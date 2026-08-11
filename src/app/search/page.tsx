'use client';

import React, { useEffect, useState, Suspense, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/shared/components/header';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import type { MappableProperty } from '@/shared/components/map/types';
import { MapPropertyCard } from '@/shared/components/map/MapPropertyCard';
import { DatePicker } from '@/features/search/components/date-picker';
import { env } from '@/shared/lib/env';
import { useUserCurrency, useSearchStore, useDates, useActiveDropdown, useSearchFilters } from '@/stores/searchStore';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { ArrowLeft, List, Map as MapIcon, SlidersHorizontal, MapPin, Search, Calendar, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const SearchMapContainer = dynamic(
    () => import('@/shared/components/mapbox/SearchMapContainer').then(m => m.SearchMapContainer),
    { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 dark:bg-slate-900 animate-pulse" /> }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type StreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
type ViewMode = 'map' | 'list';
type SortValue = 'recommended' | 'price-low' | 'price-high' | 'rating' | 'most-reviewed';

const SORT_PILLS: { value: SortValue; label: string }[] = [
    { value: 'recommended',  label: 'Recommended' },
    { value: 'price-low',    label: 'Cheapest first' },
    { value: 'rating',       label: 'Top Rated' },
    { value: 'most-reviewed', label: 'Most Reviewed' },
    { value: 'price-high',   label: 'Price: High to Low' },
];

const LIST_PAGE_SIZE = 15;

// ─── Adapter ─────────────────────────────────────────────────────────────────

function toMappable(h: any): MappableProperty | null {
    const lat = h.lat ?? h.latitude ?? h.coordinates?.lat;
    const lng = h.lng ?? h.longitude ?? h.coordinates?.lng;
    if (!lat || !lng) return null;
    return {
        id: h.id ?? h.hotelId,
        name: h.name,
        price: typeof h.price === 'number' ? h.price : parseFloat(h.price ?? '0'),
        currency: h.currency ?? 'USD',
        coordinates: { lat: Number(lat), lng: Number(lng) },
        images: h.images ?? (h.thumbnailUrl ? [h.thumbnailUrl] : []),
        image: h.images?.[0] ?? h.thumbnailUrl ?? h.image,
        rating: h.reviewScore ?? h.rating,
        reviewScore: h.reviewScore,
        reviewCount: h.reviewCount,
        refundableTag: h.refundableTag,
        starRating: h.starRating,
        location: h.location,
        city: h.city,
        country: h.country,
        boardType: h.boardType,
        priceLoading: h.priceLoading,
        originalPrice: h.originalPrice,
    };
}

function sortHotels(list: MappableProperty[], sortBy: SortValue): MappableProperty[] {
    const copy = [...list];
    if (sortBy === 'price-low')    copy.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-high')   copy.sort((a, b) => b.price - a.price);
    if (sortBy === 'rating')       copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sortBy === 'most-reviewed') copy.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return copy;
}

// ─── Search Refinement Bar (date/guest re-search) — v1 port ─────────────────

function SearchRefinementBar({ rawSearchParams }: { rawSearchParams: Record<string, string> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setDates, setActiveDropdown } = useSearchStore();
    const { checkIn: storeCheckIn, checkOut: storeCheckOut } = useDates();
    const activeDropdown = useActiveDropdown();

    const [adults, setAdults] = useState(Number(rawSearchParams.adults) || 2);
    const [children] = useState(Number(rawSearchParams.children) || 0);

    // Sync URL dates → store on mount
    useEffect(() => {
        const ci = rawSearchParams.checkIn;
        const co = rawSearchParams.checkOut;
        if (ci) setDates({ checkIn: new Date(ci + 'T00:00:00'), checkOut: co ? new Date(co + 'T00:00:00') : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const nights = useMemo(() => {
        if (!storeCheckIn || !storeCheckOut) return 1;
        const n = Math.round((storeCheckOut.getTime() - storeCheckIn.getTime()) / 86_400_000);
        return n > 0 ? n : 1;
    }, [storeCheckIn, storeCheckOut]);

    const fmtDay = (d: Date | null) =>
        d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—';

    function handleSearch() {
        const checkin  = storeCheckIn?.toISOString().slice(0, 10);
        const checkout = storeCheckOut?.toISOString().slice(0, 10);
        if (!checkin || !checkout) return;
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('checkIn', checkin);
        params.set('checkOut', checkout);
        params.set('adults', String(adults));
        params.set('children', String(children));
        router.push(`/search?${params.toString()}`);
    }

    return (
        <div className="shrink-0 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 px-3 py-2">
            <div className="max-w-2xl mx-auto">
                {/* Desktop */}
                <div className="hidden sm:flex items-center w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm h-14">
                    {/* Check-in */}
                    <div className="relative flex-1 min-w-0 h-full">
                        <div
                            className="flex flex-col justify-center px-5 h-full cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-100 dark:border-slate-800 rounded-l-2xl"
                            onClick={() => setActiveDropdown(activeDropdown === 'dates-in' ? null : 'dates-in')}
                            data-datepicker-trigger
                        >
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check-in</span>
                            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight whitespace-nowrap">{fmtDay(storeCheckIn)}</span>
                        </div>
                        <DatePicker triggerDropdown="dates-in" />
                    </div>

                    {/* Nights */}
                    <div className="flex flex-col items-center justify-center px-2.5 h-full bg-slate-50 dark:bg-slate-800/40 border-r border-slate-100 dark:border-slate-800 shrink-0">
                        <span className="text-[11px] font-bold text-blue-500">{nights}</span>
                        <span className="text-[9px] text-slate-400 leading-none">nights</span>
                    </div>

                    {/* Check-out */}
                    <div className="relative flex-1 min-w-0 h-full">
                        <div
                            className="flex flex-col justify-center px-5 h-full cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-100 dark:border-slate-800"
                            onClick={() => setActiveDropdown(activeDropdown === 'dates-out' ? null : 'dates-out')}
                            data-datepicker-trigger
                        >
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check-out</span>
                            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight whitespace-nowrap">{fmtDay(storeCheckOut)}</span>
                        </div>
                        <DatePicker initialCheckOutMode triggerDropdown="dates-out" />
                    </div>

                    {/* Guests */}
                    <div className="flex flex-col justify-center px-4 border-r border-slate-100 dark:border-slate-800 shrink-0 h-full">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Guests</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <button onClick={() => setAdults(a => Math.max(1, a - 1))} className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer text-base font-light leading-none select-none">−</button>
                            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 w-4 text-center tabular-nums">{adults + children}</span>
                            <button onClick={() => setAdults(a => Math.min(16, a + 1))} className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer text-base font-light leading-none select-none">+</button>
                        </div>
                    </div>

                    {/* Search */}
                    <button onClick={handleSearch} className="flex items-center justify-center gap-2 px-6 h-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer shrink-0 rounded-r-2xl">
                        <Search size={15} />
                        <span>Search</span>
                    </button>
                </div>

                {/* Mobile */}
                <div className="flex sm:hidden items-center gap-2 w-full">
                    <div className="relative flex-1 h-full">
                        <button
                            className="flex items-center gap-2 w-full px-3 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-left"
                            onClick={() => setActiveDropdown(activeDropdown === 'dates-in' ? null : 'dates-in')}
                            data-datepicker-trigger
                        >
                            <Calendar size={14} className="text-blue-400 shrink-0" />
                            <span className="text-slate-700 dark:text-slate-200 text-xs truncate">{fmtDay(storeCheckIn)} → {fmtDay(storeCheckOut)}</span>
                        </button>
                        <DatePicker triggerDropdown="dates-in" />
                    </div>
                    <button onClick={handleSearch} className="shrink-0 flex items-center gap-1 px-3 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">
                        <Search size={13} />
                        Search
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Filter Panel — v1 port ───────────────────────────────────────────────────

const PROPERTY_TYPE_OPTIONS = [
    { value: 'hotel',     label: 'Hotel' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'resort',    label: 'Resort' },
    { value: 'villa',     label: 'Villa' },
];

const BOARD_TYPE_OPTIONS = [
    { code: 'RO', label: 'Room Only' },
    { code: 'BB', label: 'Breakfast' },
    { code: 'HB', label: 'Half Board' },
    { code: 'FB', label: 'Full Board' },
    { code: 'AI', label: 'All Inclusive' },
];

function FilterPanel({ visible }: { visible: boolean }) {
    const filters = useSearchFilters();
    const { togglePropertyType, toggleBoardType, setRefundable, resetFilters } = useSearchStore();
    const { propertyTypes, boardTypes, refundable } = filters;
    const activeCount = propertyTypes.length + boardTypes.length + (refundable !== null ? 1 : 0);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0"
                >
                    <div className="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap gap-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Property Type</p>
                            <div className="flex flex-wrap gap-1.5">
                                {PROPERTY_TYPE_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => togglePropertyType(opt.value)}
                                        className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer',
                                            propertyTypes.includes(opt.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400')}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Meal Plan</p>
                            <div className="flex flex-wrap gap-1.5">
                                {BOARD_TYPE_OPTIONS.map(opt => (
                                    <button key={opt.code} onClick={() => toggleBoardType(opt.code)}
                                        className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer',
                                            boardTypes.includes(opt.code) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400')}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cancellation</p>
                            <div className="flex gap-1.5">
                                {([{ v: null, l: 'Any' }, { v: true, l: 'Free Cancel' }] as const).map(({ v, l }) => (
                                    <button key={String(v)} onClick={() => setRefundable(v)}
                                        className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer',
                                            refundable === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400')}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeCount > 0 && (
                            <div className="flex items-end">
                                <button onClick={() => resetFilters()} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer">
                                    Clear filters
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ─── Streaming banner ─────────────────────────────────────────────────────────

function StreamingBanner({ count, loading }: { count: number; loading: boolean }) {
    if (!loading && count === 0) return null;
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 shadow-lg rounded-full px-3.5 py-1.5 border border-slate-100 dark:border-slate-700 text-xs whitespace-nowrap">
                {loading && <span className="w-3 h-3 rounded-full border-[1.5px] border-blue-500 border-t-transparent animate-spin shrink-0" />}
                <span className="text-slate-600 dark:text-slate-300">
                    {loading
                        ? <>Searching{count > 0 ? <> &middot; <strong className="text-slate-800 dark:text-slate-100">{count}</strong> found</> : ''}…</>
                        : <><strong className="text-slate-800 dark:text-slate-100">{count}</strong> properties found</>
                    }
                </span>
            </div>
        </div>
    );
}

// ─── Price-loading skeleton sidebar ──────────────────────────────────────────

function PriceLoadingSidebar({ destination }: { destination: string }) {
    return (
        <div className="flex flex-col gap-3 p-3 overflow-y-auto">
            <div className="px-1 py-3 text-center select-none">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    {destination ? `Finding hotels in ${destination}…` : 'Finding hotels…'}
                </p>
            </div>
            {[1, 2, 3, 4].map(n => (
                <div key={n} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 p-3 flex gap-3 animate-pulse">
                    <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <div className="flex-1 flex flex-col gap-2 py-1">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mt-auto" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Inner client component ───────────────────────────────────────────────────

function HotelSearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const destination = searchParams.get('destination') ?? '';
    const checkIn     = searchParams.get('checkIn')     ?? '';
    const checkOut    = searchParams.get('checkOut')    ?? '';
    const adults      = searchParams.get('adults')      ?? '2';
    const children    = searchParams.get('children')    ?? '0';
    const rooms       = searchParams.get('rooms')       ?? '1';
    const lat         = searchParams.get('lat')         ?? '';
    const lng         = searchParams.get('lng')         ?? '';
    const countryCode = searchParams.get('countryCode') ?? '';
    const searchQs    = searchParams.toString();

    const [hotels, setHotels]         = useState<MappableProperty[]>([]);
    const [status, setStatus]         = useState<StreamStatus>('idle');
    const [viewMode, setViewMode]     = useState<ViewMode>('map');
    const [sortBy, setSortBy]         = useState<SortValue>('recommended');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId]   = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [displayCount, setDisplayCount] = useState(LIST_PAGE_SIZE);
    const [showMobileCards, setShowMobileCards] = useState(true);

    const cardRefs = useRef<Record<string, HTMLDivElement>>({});
    const lastScrolledIdRef = useRef<string | null>(null);
    const loadMoreFirstIdxRef = useRef<number | null>(null);

    const searchKey = `${destination}|${checkIn}|${checkOut}|${adults}|${children}|${rooms}|${lat}|${lng}`;

    // Reset pagination on new search
    useEffect(() => { setDisplayCount(LIST_PAGE_SIZE); }, [searchKey]);

    useEffect(() => {
        if (!destination && !lat) return;

        let cancelled = false;
        let accumulated = 0;
        const controller = new AbortController();
        setStatus('loading');
        setHotels([]);
        setSelectedId(null);

        const run = async () => {
            const body: Record<string, any> = {
                destination, checkIn, checkOut,
                adults: Number(adults), children: Number(children), rooms: Number(rooms),
            };
            if (lat) body.lat = Number(lat);
            if (lng) body.lng = Number(lng);
            if (countryCode) body.countryCode = countryCode;

            const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/hotels/search/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
                credentials: 'include',
            });

            if (!res.ok || !res.body) { if (!cancelled) setStatus('error'); return; }

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done || cancelled) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    const json = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
                    try {
                        const chunk = JSON.parse(json);
                        if ((chunk.type === 'instant' || chunk.type === 'hotels') &&
                            Array.isArray(chunk.hotels) && chunk.hotels.length > 0) {
                            accumulated = chunk.hotels.length;
                            const mapped = chunk.hotels.map(toMappable).filter(Boolean) as MappableProperty[];
                            if (!cancelled) { setHotels(mapped); setStatus('streaming'); }
                        } else if (chunk.type === 'done') {
                            if (!cancelled) setStatus('done');
                        } else if (chunk.type === 'error') {
                            console.error('[search] stream error:', chunk.message);
                            if (!cancelled) setStatus(accumulated > 0 ? 'done' : 'error');
                        }
                    } catch { /* skip malformed */ }
                }
            }
            if (!cancelled) setStatus(accumulated > 0 ? 'done' : 'error');
        };

        run().catch((err) => { if (!cancelled && err?.name !== 'AbortError') setStatus('error'); });
        return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);

    // Sort + paginate — matches v1's sortedProperties / visibleProperties pattern
    const sortedProperties = useMemo(() => sortHotels(hotels, sortBy), [hotels, sortBy]);
    const canLoadMore = displayCount < sortedProperties.length;
    const visibleProperties = useMemo(() => sortedProperties.slice(0, displayCount), [sortedProperties, displayCount]);

    const handleShowMore = useCallback(() => {
        setDisplayCount(prev => {
            loadMoreFirstIdxRef.current = prev;
            return prev + LIST_PAGE_SIZE;
        });
    }, []);

    // Scroll to first newly loaded card after load more
    useEffect(() => {
        if (loadMoreFirstIdxRef.current === null) return;
        const idx = loadMoreFirstIdxRef.current;
        loadMoreFirstIdxRef.current = null;
        const firstNew = sortedProperties[idx];
        if (!firstNew) return;
        const card = cardRefs.current[firstNew.id];
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [visibleProperties]); // eslint-disable-line react-hooks/exhaustive-deps

    const defaultCenter = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;

    const handleViewDetails = useCallback((id: string) => {
        router.push(`/property/${id}?${searchQs}`);
    }, [router, searchQs]);

    const handleCardSelect = useCallback((id: string) => {
        setSelectedId(prev => prev === id ? null : id);
    }, []);

    const handleHover = useCallback((id: string | null) => {
        setHoveredId(id);
    }, []);

    // Scroll desktop list to selected card
    useEffect(() => {
        if (!selectedId) { lastScrolledIdRef.current = null; return; }
        if (lastScrolledIdRef.current === selectedId) return;
        const card = cardRefs.current[selectedId];
        if (card) {
            lastScrolledIdRef.current = selectedId;
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            const idx = sortedProperties.findIndex(p => p.id === selectedId);
            if (idx !== -1) setDisplayCount(prev => Math.max(prev, idx + 1));
        }
    }, [selectedId, visibleProperties]); // eslint-disable-line react-hooks/exhaustive-deps

    const targetCurrency = useUserCurrency();

    const priceRange = useMemo(() => {
        const prices = sortedProperties.map(p => p.price).filter(p => p > 0);
        if (prices.length === 0) return null;
        return { min: Math.min(...prices), max: Math.max(...prices) };
    }, [sortedProperties]);

    const isLoading   = status === 'loading';
    const isStreaming = status === 'streaming';
    const isError     = status === 'error';
    const count       = hotels.length;

    // ── Loading ──────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-1 flex-col h-[calc(100dvh-57px)]">
                {/* top bar skeleton */}
                <div className="shrink-0 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 h-12" />
                <div className="hidden lg:flex flex-1 min-h-0 relative gap-4 p-4">
                    <div className="w-[420px] shrink-0 h-full">
                        <PriceLoadingSidebar destination={destination} />
                    </div>
                    <div className="flex-1 h-full bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800 shadow-sm" />
                </div>
                <div className="flex lg:hidden flex-1 items-center justify-center">
                    <span className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                </div>
            </div>
        );
    }

    if (isError && count === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 h-[calc(100dvh-57px)]">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Search failed.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Failed to fetch. Please try again.</p>
            </div>
        );
    }

    // ── List view ────────────────────────────────────────────────────────────
    if (viewMode === 'list') {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-20 flex justify-end px-4 py-2 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('map')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <MapIcon size={12} /> Map
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900">
                            <List size={12} /> List
                        </button>
                    </div>
                </div>
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
                    <HotelResults
                        hotels={sortedProperties as unknown as HotelResult[]}
                        loading={false}
                        error={isError ? 'Search failed. Please try again.' : null}
                        destination={destination}
                        searchQs={searchQs}
                    />
                </div>
            </div>
        );
    }

    // ── Map view — direct port of v1's SearchMapView ──────────────────────────
    const rawSearchParams: Record<string, string> = {
        checkIn: checkIn, checkOut: checkOut,
        adults: adults, children: children, rooms: rooms,
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* ── Search refinement bar — matches v1 ── */}
            <SearchRefinementBar rawSearchParams={rawSearchParams} />

            {/* ── Top bar — matches v1 ── */}
            <div className="shrink-0 bg-white dark:bg-slate-950 z-30 relative border-b border-slate-100 dark:border-slate-800/60 p-[10px]">
                <div className="max-w-[1400px] mx-auto px-3 flex items-center gap-2">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1 text-[10px] sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={12} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

                    <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-blue-500" />
                        <span className="text-sm md:text-base font-semibold text-slate-900 dark:text-white truncate max-w-[100px] sm:max-w-[200px]">
                            {destination || 'Search results'}
                        </span>
                    </div>

                    {priceRange && (
                        <>
                            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden md:block" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
                                {formatCurrency(convertCurrency(priceRange.min, sortedProperties[0]?.currency || 'USD', targetCurrency), targetCurrency)}
                                {' – '}
                                {formatCurrency(convertCurrency(priceRange.max, sortedProperties[0]?.currency || 'USD', targetCurrency), targetCurrency)}
                                {' /night'}
                            </span>
                        </>
                    )}

                    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                        {count > 0 && (
                            <span className="hidden sm:inline px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                {count} properties
                            </span>
                        )}

                        {/* Sort pills */}
                        <div className="hidden sm:flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                            {SORT_PILLS.map(pill => (
                                <button
                                    key={pill.value}
                                    onClick={() => setSortBy(pill.value)}
                                    className={cn(
                                        'px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold border whitespace-nowrap transition-colors cursor-pointer',
                                        sortBy === pill.value
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                    )}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>

                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={cn(
                                'flex items-center gap-1 px-2.5 h-[24px] md:h-8 rounded-full border text-[10px] md:text-[11px] font-bold transition-colors cursor-pointer',
                                showFilters
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                            )}
                        >
                            <SlidersHorizontal size={12} />
                            <span className="hidden sm:inline">Filters</span>
                        </button>

                        {/* List view toggle */}
                        <button
                            onClick={() => setViewMode('list')}
                            className="hidden sm:flex items-center gap-1 px-2.5 h-[24px] md:h-8 rounded-full border text-[10px] md:text-[11px] font-bold transition-colors cursor-pointer bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                        >
                            <List size={12} />
                            <span>List</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Filter panel — matches v1 ── */}
            <FilterPanel visible={showFilters} />

            <StreamingBanner count={count} loading={isStreaming} />

            {/* ── Desktop split — exact v1 layout ── */}
            <div className="hidden lg:flex flex-1 min-h-0 relative gap-4 p-4">
                {/* LEFT: plain scrollable list, no container border — matches v1 */}
                <div className="w-[420px] xl:w-[calc(420px+max(0px,50vw-700px))] xl:pl-[max(0px,50vw-700px)] shrink-0 h-full flex flex-col">
                    {sortedProperties.length > 0 ? (
                        <>
                            <div className="flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
                                {visibleProperties.map((property, idx) => (
                                    <div
                                        key={property.id}
                                        ref={(el) => { if (el) cardRefs.current[property.id] = el; else delete cardRefs.current[property.id]; }}
                                    >
                                        <MapPropertyCard
                                            property={property}
                                            isSelected={selectedId === property.id}
                                            isHovered={hoveredId === property.id}
                                            onSelect={handleCardSelect}
                                            onHover={handleHover}
                                            onViewDetails={handleViewDetails}
                                            index={idx + 1}
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* Sticky footer: Load More or all-results text — matches v1 */}
                            <div className="shrink-0 py-3 px-3">
                                {canLoadMore ? (
                                    <button
                                        onClick={handleShowMore}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-full transition-all active:scale-95 cursor-pointer"
                                    >
                                        Load more · {displayCount} of {sortedProperties.length}
                                    </button>
                                ) : (
                                    <p className="text-center text-[10px] text-slate-400 font-medium">
                                        All {sortedProperties.length} results loaded
                                    </p>
                                )}
                            </div>
                        </>
                    ) : hotels.some(h => h.priceLoading) ? (
                        <PriceLoadingSidebar destination={destination} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                            <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {destination ? `No hotels in ${destination}` : 'No hotels found'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try different dates or destination.</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: map — border + shadow, no rounded-xl — matches v1 */}
                <div
                    className="flex-1 h-full relative overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
                    style={{ marginRight: 'max(0px, calc((100vw - 1400px) / 2))' }}
                >
                    <SearchMapContainer
                        properties={sortedProperties}
                        selectedId={selectedId}
                        onSelectId={setSelectedId}
                        hoveredId={hoveredId}
                        onHoverId={setHoveredId}
                        onViewDetails={handleViewDetails}
                        defaultCenter={defaultCenter}
                        searchOverlayClassName="absolute top-4 left-20 z-20 w-[300px] md:w-[360px]"
                    />
                </div>
            </div>

            {/* ── Mobile map + bottom swiper — matches v1 ── */}
            <div className={cn('flex lg:hidden flex-1 relative min-h-0 w-full')}>
                <SearchMapContainer
                    properties={sortedProperties}
                    selectedId={selectedId}
                    onSelectId={setSelectedId}
                    hoveredId={hoveredId}
                    onHoverId={setHoveredId}
                    onViewDetails={handleViewDetails}
                    defaultCenter={defaultCenter}
                    searchOverlayClassName="absolute top-4 left-4 right-14 z-20"
                />

                {/* Horizontal swiper */}
                <AnimatePresence>
                    {showMobileCards && sortedProperties.length > 0 && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.2}
                            dragDirectionLock
                            onDragEnd={(_, info) => { if (info.offset.y > 40) setShowMobileCards(false); }}
                            className="absolute bottom-[58px] left-0 right-0 w-full z-20"
                        >
                            <div className="px-4 pb-1.5 flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    {count} properties found
                                </span>
                                <span className="text-[10px] text-slate-400">Swipe to browse</span>
                            </div>
                            <div className="w-full overflow-x-auto pb-2 px-3 snap-x snap-mandatory flex gap-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
                                {sortedProperties.slice(0, 50).map((property, idx) => (
                                    <div key={property.id} className="snap-center shrink-0 w-[72vw] sm:w-[280px] shadow-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                        <MapPropertyCard
                                            property={property}
                                            isSelected={selectedId === property.id}
                                            isHovered={hoveredId === property.id}
                                            onSelect={handleCardSelect}
                                            onHover={handleHover}
                                            onViewDetails={handleViewDetails}
                                            index={idx + 1}
                                        />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Swipe-up handle when hidden */}
                <AnimatePresence>
                    {!showMobileCards && sortedProperties.length > 0 && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute bottom-[80px] left-0 right-0 h-10 z-20 flex justify-center items-center cursor-grab"
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.2}
                            dragDirectionLock
                            onDragEnd={(_, info) => { if (info.offset.y < -30) setShowMobileCards(true); }}
                        >
                            <div className="w-12 h-1.5 bg-slate-400/60 dark:bg-slate-500/60 backdrop-blur-sm rounded-full shadow-sm" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating List button */}
                <div className={cn('absolute left-4 z-50 transition-all duration-300', showMobileCards ? 'bottom-[168px]' : 'bottom-[80px]')}>
                    <button
                        onClick={() => setViewMode('list')}
                        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 active:scale-95 transition-all flex items-center gap-1.5 font-bold text-[11px]"
                    >
                        <List size={14} />
                        List
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HotelSearchPage() {
    return (
        <div className="min-h-screen flex flex-col relative bg-slate-50 dark:bg-slate-950">
            <Header />
            <Suspense
                fallback={
                    <div className="flex-1 flex items-center justify-center h-[calc(100dvh-57px)]">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                    </div>
                }
            >
                <HotelSearchContent />
            </Suspense>
        </div>
    );
}
