'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, List, ChevronDown, ChevronUp, Sun, Moon } from 'lucide-react';
import type { MappableProperty } from '@/shared/components/map/types';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import { env } from '@/shared/lib/env';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertCurrency } from '@/shared/lib/currency';
import { useTheme } from '@/shared/components/ThemeContext';
import { SEARCH_TOKENS } from '@/features/search/types/search.types';
import type { StreamStatus, ViewMode, SortValue } from '@/features/search/types/search.types';
import { toMappable, sortHotels, fmtPill } from '@/features/search/utils/search.utils';
import { RailCard, SELECT_GUTTER, SELECT_HEADROOM } from '@/features/search/components/rail-card';
import { SearchBar } from '@/features/search/components/search-bar';
import { SortPill, sortPalette } from '@/features/search/components/sort-pill';
import { StatusScreen } from '@/features/search/components/status-screen';

const DISTRICT_MARKER_THRESHOLD = 11;

const SearchMapContainer = dynamic(
    () => import('@/shared/components/mapbox/SearchMapContainer').then((m) => m.SearchMapContainer),
    { ssr: false, loading: () => <div className="w-full h-full" style={{ background: '#1B2A2E' }} /> }
);

export function SearchView() {
    const searchParams = useSearchParams();
    const router       = useRouter();

    const destination   = searchParams.get('destination')   ?? '';
    const checkIn       = searchParams.get('checkIn')       ?? '';
    const checkOut      = searchParams.get('checkOut')      ?? '';
    const adults        = searchParams.get('adults')        ?? '2';
    const children      = searchParams.get('children')      ?? '0';
    const rooms         = searchParams.get('rooms')         ?? '1';
    const lat           = searchParams.get('lat')           ?? '';
    const lng           = searchParams.get('lng')           ?? '';
    const countryCode   = searchParams.get('countryCode')   ?? '';
    const bboxParam     = searchParams.get('bbox')          ?? '';
    const districtName  = searchParams.get('districtName')  ?? '';
    const canonicalCity = searchParams.get('canonicalCity') ?? '';
    const searchQs      = searchParams.toString();

    const [hotels, setHotels]                   = useState<MappableProperty[]>([]);
    const [status, setStatus]                   = useState<StreamStatus>('idle');
    const [viewMode, setViewMode]               = useState<ViewMode>('map');
    const [sortBy, setSortBy]                   = useState<SortValue>('recommended');
    const [selectedId, setSelectedId]           = useState<string | null>(null);
    const [hoveredId, setHoveredId]             = useState<string | null>(null);
    const [mapZoom, setMapZoom]                 = useState(11);
    const [showAllCityOverride, setShowAllCityOverride] = useState(false);
    const [railHidden, setRailHidden]           = useState(false);
    const [mapCenter, setMapCenter]             = useState<{ lat: number; lng: number } | undefined>(
        lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined
    );
    const [geocodedCoords, setGeocodedCoords]   = useState<{ lat: number; lng: number } | null>(null);

    const districtBbox = useMemo<[number, number, number, number] | undefined>(() => {
        if (!bboxParam) return undefined;
        const parts = bboxParam.split(',').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return undefined;
        return parts as [number, number, number, number];
    }, [bboxParam]);

    const currency = useUserCurrency();
    const { theme, toggleTheme } = useTheme();
    const uiTone = theme === 'dark' ? 'light' : 'dark';
    const chrome = sortPalette(uiTone);
    const searchKey = `${destination}|${checkIn}|${checkOut}|${adults}|${children}|${rooms}|${lat}|${lng}`;

    // Stream search results
    useEffect(() => {
        if (!destination && !lat) return;
        let cancelled = false;
        let accumulated = 0;
        const ctrl = new AbortController();
        setStatus('loading');
        setHotels([]);
        setSelectedId(null);
        setMapCenter(lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined);

        const searchLat = lat ? Number(lat) : null;
        const searchLng = lng ? Number(lng) : null;
        const isNearby = (h: MappableProperty) => {
            if (!searchLat || !searchLng) return true;
            const dlat = h.coordinates.lat - searchLat;
            const dlng = h.coordinates.lng - searchLng;
            return Math.sqrt(dlat * dlat + dlng * dlng) * 111 <= 150;
        };

        const run = async () => {
            const body: Record<string, unknown> = {
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
                signal: ctrl.signal,
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
                    const t = line.trim();
                    if (!t) continue;
                    const json = t.startsWith('data: ') ? t.slice(6) : t;
                    try {
                        const chunk = JSON.parse(json);
                        const list: unknown[] = Array.isArray(chunk.data) ? chunk.data : Array.isArray(chunk.hotels) ? chunk.hotels : [];
                        if ((chunk.type === 'instant' || chunk.type === 'hotels') && list.length > 0) {
                            accumulated += list.length;
                            const mapped = (list as Record<string, unknown>[]).map(toMappable).filter((h): h is MappableProperty => !!h && isNearby(h));
                            if (!cancelled) {
                                setHotels((prev) => { const m = new Map(prev.map((h) => [h.id, h])); for (const h of mapped) m.set(h.id, h); return Array.from(m.values()); });
                                setStatus('streaming');
                            }
                        } else if (chunk.type === 'prices' && Array.isArray(chunk.data)) {
                            const pm = new Map<string, Record<string, unknown>>(chunk.data.map((p: Record<string, unknown>) => [p.hotelId, p]));
                            if (!cancelled) setHotels((prev) => prev.map((h) => { const p = pm.get(h.id); return p ? { ...h, price: (p.price as number) ?? h.price, currency: (p.currency as string) ?? h.currency, priceLoading: false } : h; }));
                        } else if (chunk.type === 'remove' && Array.isArray(chunk.ids)) {
                            const s = new Set(chunk.ids as string[]);
                            if (!cancelled) setHotels((prev) => prev.filter((h) => !s.has(h.id)));
                        } else if (chunk.type === 'done' || chunk.type === 'error') {
                            if (!cancelled) { setHotels((prev) => prev.map((h) => h.priceLoading ? { ...h, priceLoading: false } : h)); setStatus(accumulated > 0 ? 'done' : 'error'); }
                            return;
                        }
                    } catch { /* skip malformed lines */ }
                }
            }
            if (!cancelled) setStatus(accumulated > 0 ? 'done' : 'error');
        };

        run().catch((err) => { if (!cancelled && err?.name !== 'AbortError') setStatus('error'); });
        return () => { cancelled = true; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);

    // Resolve destination → coords when URL has no lat/lng
    useEffect(() => {
        setGeocodedCoords(null);
        if (lat && lng) return;
        if (!destination) return;
        const apiBase = env.NEXT_PUBLIC_API_URL;
        if (!apiBase) return;
        let cancelled = false;
        fetch(`${apiBase}/hotels/suggest?q=${encodeURIComponent(destination)}`)
            .then((r) => r.json())
            .then((data: Record<string, unknown>) => {
                if (cancelled) return;
                const city = ((data.destinations as Record<string, unknown>[]) ?? []).find(
                    (d) => d.type === 'city' && typeof d.lat === 'number' && typeof d.lng === 'number'
                );
                if (city) setGeocodedCoords({ lat: city.lat as number, lng: city.lng as number });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [destination, lat, lng]);

    // Auto-center on geocoded coords or first hotel
    useEffect(() => {
        if (mapCenter) return;
        if (geocodedCoords) { setMapCenter(geocodedCoords); return; }
        const first = hotels.find((h) => h.coordinates);
        if (first?.coordinates) setMapCenter(first.coordinates);
    }, [hotels, mapCenter, geocodedCoords]);

    const effectiveLat = lat ? Number(lat) : geocodedCoords?.lat ?? null;
    const effectiveLng = lng ? Number(lng) : geocodedCoords?.lng ?? null;

    const sorted = useMemo(() => {
        let base = hotels;
        if (effectiveLat && effectiveLng) {
            base = hotels.filter((h) => {
                const dlat = h.coordinates.lat - effectiveLat;
                const dlng = h.coordinates.lng - effectiveLng;
                return Math.sqrt(dlat * dlat + dlng * dlng) * 111 <= 150;
            });
        }
        return sortHotels(base, sortBy);
    }, [hotels, sortBy, effectiveLat, effectiveLng]);

    const listHotels = useMemo(
        () => sorted.map((h) => ({ ...h, price: Math.round(convertCurrency(h.price, h.currency || 'USD', currency)), currency })),
        [sorted, currency]
    );

    const railSorted = useMemo(() => {
        if (!districtBbox || showAllCityOverride || mapZoom < DISTRICT_MARKER_THRESHOLD) return sorted;
        const [minLng, minLat, maxLng, maxLat] = districtBbox;
        return sorted.filter((p) =>
            p.coordinates.lng >= minLng && p.coordinates.lng <= maxLng &&
            p.coordinates.lat >= minLat && p.coordinates.lat <= maxLat
        );
    }, [sorted, districtBbox, showAllCityOverride, mapZoom]);

    const count = railSorted.length;

    const railCards = useMemo(() => {
        const shown = railSorted.slice(0, 50);
        const grown = new Set<number>();
        shown.forEach((p, i) => { if (p.id === selectedId || p.id === hoveredId) grown.add(i); });
        return shown.map((property, i) => ({
            property,
            isSelected: property.id === selectedId,
            isHovered:  property.id === hoveredId,
            shiftLeft:  grown.has(i - 1) ? SELECT_GUTTER : 0,
            shiftRight: grown.has(i + 1) ? SELECT_GUTTER : 0,
        }));
    }, [railSorted, selectedId, hoveredId]);

    const isLoading   = status === 'loading';
    const isStreaming = status === 'streaming';
    const pillText    = fmtPill(destination, checkIn, checkOut, adults, children);

    const handleViewDetails   = useCallback((id: string) => router.push(`/property/${id}?${searchQs}`), [router, searchQs]);
    const handleSearchSubmit  = useCallback((name: string, coords?: { lat: number; lng: number }) => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('destination', name);
        for (const stale of ['lat', 'lng', 'countryCode', 'bbox', 'districtName', 'canonicalCity']) params.delete(stale);
        if (coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)); }
        router.push(`/search?${params.toString()}`);
    }, [router, searchParams]);
    const handleSelect = useCallback((id: string) => setSelectedId((prev) => prev === id ? null : id), []);

    // Wheel → horizontal rail scroll
    const railScrollRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        let target: number | null = null;
        let raf = 0;
        const step = () => {
            const el = railScrollRef.current;
            if (!el || target === null) { raf = 0; return; }
            const distance = target - el.scrollLeft;
            if (Math.abs(distance) < 0.5) { el.scrollLeft = target; raf = 0; return; }
            el.scrollLeft += distance * 0.18;
            raf = requestAnimationFrame(step);
        };
        const onWheel = (e: WheelEvent) => {
            const el = railScrollRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (!inside) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.deltaX !== 0) { target = null; return; }
            if (target === null || !raf) target = el.scrollLeft;
            const max = el.scrollWidth - el.clientWidth;
            target = Math.max(0, Math.min(max, target - e.deltaY));
            if (!raf) raf = requestAnimationFrame(step);
        };
        window.addEventListener('wheel', onWheel, { capture: true, passive: false });
        return () => { if (raf) cancelAnimationFrame(raf); window.removeEventListener('wheel', onWheel, { capture: true }); };
    }, []);

    // ── List view ─────────────────────────────────────────────────────────────
    if (viewMode === 'list') {
        return (
            <div className="dark flex flex-col min-h-screen" style={{ background: SEARCH_TOKENS.BG, color: SEARCH_TOKENS.TEXT }}>
                <div className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14" style={{ background: 'rgba(15,11,22,0.95)', borderBottom: `1px solid ${SEARCH_TOKENS.BORDER}`, backdropFilter: 'blur(12px)' }}>
                    <button onClick={() => setViewMode('map')} className="flex items-center justify-center rounded-full cursor-pointer" style={{ width: 36, height: 36, background: SEARCH_TOKENS.OVERLAY_BG, border: `1px solid ${SEARCH_TOKENS.OVERLAY_BDR}`, flexShrink: 0 }}>
                        <ArrowLeft size={16} style={{ color: SEARCH_TOKENS.TEXT }} />
                    </button>
                    <span className="flex-1 font-semibold text-sm truncate" style={{ color: SEARCH_TOKENS.TEXT }}>{destination || 'Search results'}</span>
                    {count > 0 && <span className="text-xs" style={{ color: SEARCH_TOKENS.DIM }}>{count} properties</span>}
                    <SortPill value={sortBy} onChange={setSortBy} theme={uiTone} />
                </div>
                <div className="max-w-350 mx-auto px-4 sm:px-6 py-6 w-full">
                    <HotelResults
                        hotels={listHotels as unknown as HotelResult[]}
                        loading={isLoading}
                        error={status === 'error' ? 'Search failed. Please try again.' : null}
                        destination={destination}
                        searchQs={searchQs}
                    />
                </div>
            </div>
        );
    }

    // ── Map view ──────────────────────────────────────────────────────────────
    return (
        <div className="dark relative w-full overflow-hidden" style={{ height: '100dvh', background: SEARCH_TOKENS.BG }}>
            <div className="absolute inset-0 overflow-hidden">
                <SearchMapContainer
                    properties={sorted}
                    selectedId={selectedId}
                    onSelectId={setSelectedId}
                    hoveredId={hoveredId}
                    onHoverId={setHoveredId}
                    onViewDetails={handleViewDetails}
                    defaultCenter={mapCenter}
                    searchOverlayClassName="hidden"
                    isSearching={isLoading || isStreaming}
                    districtBbox={districtBbox}
                    districtName={districtName}
                    cityName={canonicalCity || destination}
                    onZoomChange={setMapZoom}
                    showAllProperties={showAllCityOverride}
                />
            </div>

            {/* Floating top toolbar */}
            <div className="absolute left-4 right-4 z-30 flex items-center gap-2" style={{ top: 16, height: 60, padding: '0 10px', borderRadius: 20, background: chrome.bar, border: `1px solid ${chrome.border}`, boxShadow: chrome.shadow }}>
                <button onClick={() => router.back()} className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80" style={{ width: 40, height: 40, flexShrink: 0, background: chrome.surface, border: `1px solid ${chrome.border}` }}>
                    <ArrowLeft size={18} style={{ color: chrome.text }} />
                </button>

                <SearchBar summary={pillText} searching={isLoading || isStreaming} theme={uiTone} proximity={mapCenter} onSubmit={handleSearchSubmit} />

                <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80" style={{ width: 40, height: 40, flexShrink: 0, background: chrome.surface, border: `1px solid ${chrome.border}` }}>
                    {theme === 'dark' ? <Sun size={17} style={{ color: chrome.text }} /> : <Moon size={17} style={{ color: chrome.text }} />}
                </button>

                <button onClick={() => setViewMode('list')} className="flex items-center gap-2 rounded-full shrink-0 cursor-pointer transition-opacity hover:opacity-80" style={{ height: 40, padding: '0 16px', background: chrome.surface, border: `1px solid ${chrome.border}`, color: chrome.text, fontSize: 13, fontWeight: 600 }}>
                    <List size={15} />
                    List View
                </button>

                <div className="ml-auto flex items-center gap-2">
                    {count > 0 && (
                        <div className="flex items-center gap-2 px-4 rounded-full shrink-0" style={{ height: 40, background: chrome.surface, border: `1px solid ${chrome.border}` }}>
                            {isStreaming && <div className="animate-spin flex-shrink-0" style={{ width: 11, height: 11, borderRadius: '50%', border: `1.5px solid ${chrome.border}`, borderTopColor: chrome.text }} />}
                            <span className="font-semibold whitespace-nowrap" style={{ fontSize: 13, color: chrome.text }}>
                                {isStreaming ? `${count}+` : count} stays
                            </span>
                        </div>
                    )}
                    <SortPill value={sortBy} onChange={setSortBy} theme={uiTone} />
                </div>
            </div>

            {/* Loading state */}
            {isLoading && (
                <StatusScreen busy theme={uiTone} title={`Finding Stays${destination ? ` In ${destination}` : ''}...`} lines={['Searching for Availability and Prices']} />
            )}

            {/* Empty state */}
            {status === 'error' && (
                <StatusScreen
                    theme={uiTone}
                    title="No accommodations found"
                    lines={[
                        destination ? `We couldn't find hotels in ${destination}` : "We couldn't find any hotels",
                        'Try adjusting your dates or destination',
                    ]}
                    action={{ label: 'Search Again', onClick: () => router.back() }}
                />
            )}

            {/* Bottom card rail */}
            <AnimatePresence>
                {sorted.length > 0 && !railHidden && (
                    <motion.div
                        initial={{ y: 160, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 160, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 170, delay: 0.05 }}
                        className="absolute left-0 right-0 bottom-0 z-20"
                        style={{ pointerEvents: 'none' }}
                    >
                        <div className="flex items-center justify-between px-4 mb-0.5">
                            <div className="flex items-center gap-2">
                                {isStreaming && <div className="animate-spin shrink-0" style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(180,150,255,0.3)', borderTopColor: '#a78bfa' }} />}
                                <span style={{ fontSize: 11, color: isStreaming ? 'rgba(245,239,228,0.7)' : 'rgba(245,239,228,0.5)' }}>
                                    {isStreaming ? `Searching · ${count} found…` : `${count} properties`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {districtBbox && !showAllCityOverride && mapZoom >= DISTRICT_MARKER_THRESHOLD && districtName && (
                                    <button
                                        onClick={() => setShowAllCityOverride(true)}
                                        style={{ background: 'rgba(255,107,75,0.15)', border: '1px solid rgba(255,107,75,0.4)', borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: SEARCH_TOKENS.ACCENT, cursor: 'pointer', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', pointerEvents: 'auto' }}
                                    >
                                        {districtName} · See all in {canonicalCity || destination}
                                    </button>
                                )}
                                <button
                                    onClick={() => setRailHidden(true)}
                                    aria-label="Hide stay cards"
                                    className="flex items-center justify-center rounded-full shrink-0 cursor-pointer transition-opacity hover:opacity-80"
                                    style={{ width: 40, height: 40, background: chrome.surface, border: `1px solid ${chrome.border}`, boxShadow: chrome.shadow, pointerEvents: 'auto' }}
                                >
                                    <ChevronDown size={18} style={{ color: chrome.text }} />
                                </button>
                            </div>
                        </div>

                        <div className="relative" style={{ paddingBottom: 28, paddingLeft: 24 }}>
                            <div
                                ref={railScrollRef}
                                className="flex items-end gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
                                style={{ overscrollBehaviorX: 'contain', paddingTop: SELECT_HEADROOM }}
                            >
                                {railCards.map(({ property, isSelected, isHovered, shiftLeft, shiftRight }) => (
                                    <RailCard
                                        key={property.id}
                                        property={property}
                                        isSelected={isSelected}
                                        isHovered={isHovered}
                                        shiftLeft={shiftLeft}
                                        shiftRight={shiftRight}
                                        onSelect={handleSelect}
                                        onHover={setHoveredId}
                                        onViewDetails={handleViewDetails}
                                        currency={currency}
                                        theme={uiTone}
                                    />
                                ))}
                                <div style={{ minWidth: 24, flexShrink: 0 }} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Show rail button when hidden */}
            <AnimatePresence>
                {sorted.length > 0 && railHidden && (
                    <motion.button
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
                        onClick={() => setRailHidden(false)}
                        className="absolute z-20 flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
                        style={{ right: 16, bottom: 28, background: chrome.surface, border: `1px solid ${chrome.border}`, borderRadius: 100, padding: '9px 15px', fontSize: 12, fontWeight: 700, color: chrome.text, boxShadow: chrome.shadow }}
                    >
                        <ChevronUp size={14} />
                        Show {count} stays
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
