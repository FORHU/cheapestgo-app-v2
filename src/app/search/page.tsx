'use client';

import React, { useEffect, useState, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { MappableProperty } from '@/shared/components/map/types';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import { env } from '@/shared/lib/env';
import { useUserCurrency } from '@/stores/searchStore';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { ArrowLeft, List, Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT        = '#FF6B4B';
const TEXT          = '#F5EFE4';
const BG            = '#15111E';
const SURFACE       = 'rgba(28,23,36,0.97)';
const BORDER        = 'rgba(255,255,255,0.08)';
const DIM           = 'rgba(245,239,228,0.45)';
const OVERLAY_BG    = 'rgba(28,23,36,0.82)';
const OVERLAY_BDR   = 'rgba(255,255,255,0.15)';

const SearchMapContainer = dynamic(
    () => import('@/shared/components/mapbox/SearchMapContainer').then(m => m.SearchMapContainer),
    { ssr: false, loading: () => <div className="w-full h-full" style={{ background: '#1B2A2E' }} /> }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type StreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
type ViewMode = 'map' | 'list';
type SortValue = 'recommended' | 'price-low' | 'price-high' | 'rating' | 'most-reviewed';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
    { value: 'recommended',   label: 'Recommended' },
    { value: 'price-low',     label: 'Cheapest first' },
    { value: 'rating',        label: 'Top Rated' },
    { value: 'most-reviewed', label: 'Most Reviewed' },
    { value: 'price-high',    label: 'Price: High to Low' },
];

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

function sortHotels(list: MappableProperty[], by: SortValue): MappableProperty[] {
    const c = [...list];
    if (by === 'price-low')     c.sort((a, b) => a.price - b.price);
    if (by === 'price-high')    c.sort((a, b) => b.price - a.price);
    if (by === 'rating')        c.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (by === 'most-reviewed') c.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return c;
}

function fmtPill(destination: string, checkIn: string, checkOut: string, adults: string, children: string) {
    const parts: string[] = [];
    if (destination) parts.push(destination);
    if (checkIn && checkOut) {
        const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        parts.push(`${fmt(checkIn)} – ${fmt(checkOut)}`);
    }
    const guests = (Number(adults) || 2) + (Number(children) || 0);
    parts.push(`${guests} guest${guests !== 1 ? 's' : ''}`);
    return parts.join(' · ');
}

function ratingColor(r: number) {
    if (r >= 9) return '#2FB67F';
    if (r >= 8) return '#22c55e';
    if (r >= 7) return '#4FA8E0';
    if (r >= 5) return '#f97316';
    return '#ef4444';
}

// ─── Bottom rail card (matches design exactly) ────────────────────────────────
function RailCard({
    property, isSelected, onSelect, onViewDetails, currency,
}: {
    property: MappableProperty; isSelected: boolean;
    onSelect: (id: string) => void; onViewDetails: (id: string) => void; currency: string;
}) {
    const price = convertCurrency(property.price, property.currency || 'USD', currency);
    const priceStr = formatCurrency(price, currency);
    const rating = property.rating ?? 0;

    return (
        <div
            onClick={() => onSelect(property.id)}
            className="shrink-0 cursor-pointer"
            style={{
                width: 190, borderRadius: 18,
                background: SURFACE,
                border: `1.5px solid ${isSelected ? ACCENT : BORDER}`,
                overflow: 'visible',
                boxShadow: isSelected
                    ? `0 0 0 2px ${ACCENT}, 0 8px 32px rgba(255,107,75,0.25)`
                    : '0 4px 28px rgba(0,0,0,0.55)',
                transition: 'border-color .2s, box-shadow .2s',
                position: 'relative',
            }}
        >
            {/* Image */}
            <div style={{ height: 108, borderRadius: '16px 16px 0 0', overflow: 'hidden', position: 'relative', background: 'rgba(255,255,255,0.04)' }}>
                {property.image ? (
                    <Image src={property.image} alt={property.name} fill className="object-cover" sizes="190px" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <Building2 size={22} style={{ color: DIM }} />
                    </div>
                )}
                {/* Free cancel tag */}
                {property.refundableTag === 'RFN' && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: '#2FB67F', zIndex: 2 }}>
                        Free cancel
                    </span>
                )}
            </div>

            {/* Price circle — overlaps image/body boundary */}
            <div className="absolute flex items-center justify-center" style={{
                width: 50, height: 50, borderRadius: '50%',
                background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                bottom: 82, right: 10, zIndex: 10,
            }}>
                {property.priceLoading ? (
                    <div className="animate-pulse rounded-full" style={{ width: 30, height: 12, background: 'rgba(0,0,0,0.1)' }} />
                ) : (
                    <span style={{ fontSize: 9.5, fontWeight: 900, color: '#15111E', lineHeight: 1.1, textAlign: 'center', padding: '0 4px' }}>
                        {priceStr}
                    </span>
                )}
            </div>

            {/* Card body */}
            <div style={{ padding: '20px 14px 12px', borderRadius: '0 0 16px 16px', background: SURFACE }}>
                <h3 style={{
                    fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: '"Fredoka One", "Fredoka", system-ui, sans-serif',
                }}>
                    {property.name}
                </h3>
                {(property.location || property.city) && (
                    <p style={{ fontSize: 11, color: DIM, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {property.location ?? property.city}
                    </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    {rating > 0 ? (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: ratingColor(rating), color: '#fff',
                            borderRadius: 100, padding: '3px 8px',
                            fontSize: 11, fontWeight: 800,
                        }}>
                            {rating.toFixed(1)}
                        </span>
                    ) : <span />}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(property.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: ACCENT, padding: 0 }}>
                        View stay →
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────
function SortPill({ value, onChange }: { value: SortValue; onChange: (v: SortValue) => void }) {
    const [open, setOpen] = useState(false);
    const label = SORT_OPTIONS.find(o => o.value === value)?.label ?? 'Recommended';

    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setOpen(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: ACCENT, border: 'none',
                borderRadius: 100, padding: '0 14px', height: 40,
                color: '#fff', fontSize: 13, fontWeight: 700,
                boxShadow: '0 2px 14px rgba(255,107,75,0.4)',
                cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
                {label}
                <ChevronDown size={13} style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 6,
                            zIndex: 100, minWidth: 170, borderRadius: 12, overflow: 'hidden',
                            background: 'rgba(22,17,32,0.98)', border: `1px solid ${BORDER}`,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        }}>
                        {SORT_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '10px 16px', fontSize: 12, fontWeight: 600,
                                color: value === opt.value ? ACCENT : TEXT,
                                background: 'none', border: 'none', cursor: 'pointer',
                            }}>
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function HotelSearchContent() {
    const searchParams = useSearchParams();
    const router       = useRouter();

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

    const currency   = useUserCurrency();
    const searchKey  = `${destination}|${checkIn}|${checkOut}|${adults}|${children}|${rooms}|${lat}|${lng}`;

    useEffect(() => {
        if (!destination && !lat) return;
        let cancelled = false;
        let accumulated = 0;
        const ctrl = new AbortController();
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
                        const list: any[] = Array.isArray(chunk.data) ? chunk.data : Array.isArray(chunk.hotels) ? chunk.hotels : [];
                        if ((chunk.type === 'instant' || chunk.type === 'hotels') && list.length > 0) {
                            accumulated += list.length;
                            const mapped = list.map(toMappable).filter(Boolean) as MappableProperty[];
                            if (!cancelled) { setHotels(prev => { const m = new Map(prev.map(h => [h.id, h])); for (const h of mapped) m.set(h.id, h); return Array.from(m.values()); }); setStatus('streaming'); }
                        } else if (chunk.type === 'prices' && Array.isArray(chunk.data)) {
                            const pm = new Map(chunk.data.map((p: any) => [p.hotelId, p]));
                            if (!cancelled) setHotels(prev => prev.map(h => { const p = pm.get(h.id); return p ? { ...h, price: p.price ?? h.price, currency: p.currency ?? h.currency } : h; }));
                        } else if (chunk.type === 'remove' && Array.isArray(chunk.ids)) {
                            const s = new Set(chunk.ids as string[]);
                            if (!cancelled) setHotels(prev => prev.filter(h => !s.has(h.id)));
                        } else if (chunk.type === 'done' || chunk.type === 'error') {
                            if (!cancelled) setStatus(accumulated > 0 ? 'done' : 'error'); return;
                        }
                    } catch { /* skip */ }
                }
            }
            if (!cancelled) setStatus(accumulated > 0 ? 'done' : 'error');
        };

        run().catch(err => { if (!cancelled && err?.name !== 'AbortError') setStatus('error'); });
        return () => { cancelled = true; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);

    const sorted       = useMemo(() => sortHotels(hotels, sortBy), [hotels, sortBy]);
    const defaultCenter = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
    const count        = hotels.length;
    const isLoading    = status === 'loading';
    const isStreaming  = status === 'streaming';
    const pillText     = fmtPill(destination, checkIn, checkOut, adults, children);

    const handleViewDetails = useCallback((id: string) => router.push(`/property/${id}?${searchQs}`), [router, searchQs]);
    const handleSelect      = useCallback((id: string) => setSelectedId(prev => prev === id ? null : id), []);

    // ── List view ─────────────────────────────────────────────────────────────
    if (viewMode === 'list') {
        return (
            <div className="dark flex flex-col min-h-screen" style={{ background: BG, color: TEXT }}>
                <div className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14"
                    style={{ background: 'rgba(15,11,22,0.95)', borderBottom: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
                    <button onClick={() => setViewMode('map')}
                        className="flex items-center justify-center rounded-full cursor-pointer"
                        style={{ width: 36, height: 36, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BDR}`, flexShrink: 0 }}>
                        <ArrowLeft size={16} style={{ color: TEXT }} />
                    </button>
                    <span className="flex-1 font-semibold text-sm truncate" style={{ color: TEXT }}>
                        {destination || 'Search results'}
                    </span>
                    {count > 0 && <span className="text-xs" style={{ color: DIM }}>{count} properties</span>}
                    <SortPill value={sortBy} onChange={setSortBy} />
                </div>
                <div className="max-w-350 mx-auto px-4 sm:px-6 py-6 w-full">
                    <HotelResults
                        hotels={sorted as unknown as HotelResult[]}
                        loading={isLoading}
                        error={status === 'error' ? 'Search failed. Please try again.' : null}
                        destination={destination}
                        searchQs={searchQs}
                    />
                </div>
            </div>
        );
    }

    // ── Full-screen map view ──────────────────────────────────────────────────
    return (
        <div className="dark relative w-full overflow-hidden" style={{ height: '100dvh', background: BG }}>

            {/* Map fills entire screen */}
            <div className="absolute inset-0">
                <SearchMapContainer
                    properties={sorted}
                    selectedId={selectedId}
                    onSelectId={setSelectedId}
                    hoveredId={hoveredId}
                    onHoverId={setHoveredId}
                    onViewDetails={handleViewDetails}
                    defaultCenter={defaultCenter}
                    searchOverlayClassName="hidden"
                />
            </div>

            {/* ── Floating top bar ─────────────────────────────── */}
            <div className="absolute left-4 right-4 z-30 flex items-center gap-2" style={{ top: 16 }}>
                {/* Back */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80"
                    style={{ width: 40, height: 40, flexShrink: 0, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BDR}`, backdropFilter: 'blur(10px)' }}>
                    <ArrowLeft size={18} style={{ color: TEXT }} />
                </button>

                {/* Destination pill */}
                <div className="flex-1 min-w-0 flex items-center px-4 rounded-full"
                    style={{ height: 40, background: 'rgba(28,23,36,0.72)', border: `1px solid ${OVERLAY_BDR}`, backdropFilter: 'blur(10px)' }}>
                    <span className="truncate font-medium" style={{ fontSize: 13, color: TEXT }}>
                        {pillText}
                    </span>
                </div>

                {/* Count badge */}
                {count > 0 && (
                    <div className="flex items-center px-3 rounded-full shrink-0"
                        style={{ height: 40, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BDR}`, backdropFilter: 'blur(10px)' }}>
                        <span className="font-semibold whitespace-nowrap" style={{ fontSize: 13, color: TEXT }}>
                            {isStreaming ? `${count}+` : count} stays
                        </span>
                    </div>
                )}

                {/* Sort */}
                <SortPill value={sortBy} onChange={setSortBy} />
            </div>

            {/* Loading spinner */}
            {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <div className="rounded-full border-2 border-t-transparent animate-spin"
                        style={{ width: 36, height: 36, borderColor: ACCENT, borderTopColor: 'transparent' }} />
                    <span className="font-medium" style={{ fontSize: 13, color: TEXT }}>
                        Finding stays{destination ? ` in ${destination}` : ''}…
                    </span>
                </div>
            )}

            {/* ── Bottom card rail ──────────────────────────────── */}
            <AnimatePresence>
                {sorted.length > 0 && (
                    <motion.div
                        initial={{ y: 160, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 160, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 170, delay: 0.05 }}
                        className="absolute left-0 right-0 bottom-0 z-20"
                    >
                        {/* List view toggle + count */}
                        <div className="flex items-center justify-between px-4 mb-2">
                            <span style={{ fontSize: 11, color: 'rgba(245,239,228,0.5)' }}>
                                {isStreaming ? `Searching · ${count} found…` : `${count} properties`}
                            </span>
                            <button onClick={() => setViewMode('list')}
                                className="flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
                                style={{
                                    background: OVERLAY_BG, border: `1px solid ${OVERLAY_BDR}`,
                                    borderRadius: 8, padding: '6px 12px',
                                    fontSize: 11, fontWeight: 700, color: TEXT,
                                    backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                }}>
                                <List size={12} />
                                List view
                            </button>
                        </div>

                        {/* Horizontal scroll cards */}
                        <div
                            className="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
                            style={{ paddingBottom: 28 }}
                        >
                            {/* left spacer — padding-left is swallowed by overflow-x containers */}
                            <div style={{ width: 24, flexShrink: 0 }} />
                            {sorted.slice(0, 50).map(property => (
                                <RailCard
                                    key={property.id}
                                    property={property}
                                    isSelected={selectedId === property.id}
                                    onSelect={handleSelect}
                                    onViewDetails={handleViewDetails}
                                    currency={currency}
                                />
                            ))}
                            {/* right spacer */}
                            <div style={{ width: 24, flexShrink: 0 }} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HotelSearchPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center" style={{ height: '100dvh', background: BG }}>
                    <div className="rounded-full border-2 border-t-transparent animate-spin"
                        style={{ width: 32, height: 32, borderColor: ACCENT, borderTopColor: 'transparent' }} />
                </div>
            }
        >
            <HotelSearchContent />
        </Suspense>
    );
}
