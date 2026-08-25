'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Marker } from 'react-map-gl/mapbox';
import { http } from '@/shared/lib/http';
import { Map } from '@/shared/components/ui/map';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
import type { RoomOption, RateRow } from '@/features/hotels/types/property.types';
import { useUserCurrency } from '@/stores/searchStore';
import { convertCurrency } from '@/shared/lib/currency';
import { formatCurrency } from '@/shared/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotelContent {
    hotel_id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    star_rating: number | null;
    description: string | null;
    images: string[];
    amenities: string[] | null;
    lat: number | null;
    lng: number | null;
    /**
     * Front-desk hours, under both of the names suppliers give them.
     *
     * Optional because it is not certain every supplier sends either — the
     * description panel draws the IN / OUT pair only once one arrives, rather
     * than printing a plausible 3:00 PM nobody has confirmed.
     */
    check_in_time?: string | null;
    check_out_time?: string | null;
    check_in?: string | null;
    check_out?: string | null;
}

interface PropertyApiResponse {
    content?: HotelContent;
    reviews?: { rating: number | string | null; reviews_count: number } | null;
    reviewItems?: Array<{
        reviewer_name: string | null;
        score: number | string | null;
        pros: string | null;
        cons: string | null;
        headline: string | null;
        country: string | null;
    }>;
    rooms?: RoomOption[];
    error?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACCENT = '#FF6B4B';
const GREEN  = '#2FB67F';
const TEXT   = '#F5EFE4';
const BG     = '#000000';

/**
 * The page's column — one edge for every section on it, so the hero's name, the
 * description, the rooms and the bar at the bottom all start on the same line.
 *
 * It is the app shell's, shared with the search page: 16/24px of gutter, capped
 * at 1400px. A stay therefore occupies the same column in the results as it
 * does on its own page, and does not slide sideways when it is opened.
 *
 * A pair of nested elements rather than one, because the cap has to land inside
 * the padding — see `SHELL_GUTTER`. Held here as a component so the four places
 * that need it do not each write the nesting out and get it half right.
 */
function PageColumn({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div className={SHELL_GUTTER} style={style}>
            <div className={SHELL_CAP}>{children}</div>
        </div>
    );
}

function ratingInfo(score: number): { label: string; color: string } {
    if (score >= 9) return { label: 'Exceptional', color: GREEN };
    if (score >= 8) return { label: 'Excellent',   color: '#4FA8E0' };
    return                  { label: 'Good',        color: '#E0A23C' };
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
            <circle cx="12" cy="12" r="9" fill="none" stroke={ACCENT} strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
        </svg>
    );
}

// ─── Haversine distance (miles) ───────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R    = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
               + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryDotColor(cat: string): string {
    const c = cat.toLowerCase();
    if (c.includes('park') || c.includes('garden') || c.includes('nature'))      return '#10b981';
    if (c.includes('restaurant') || c.includes('cafe') || c.includes('food') || c.includes('bar')) return '#f97316';
    if (c.includes('museum') || c.includes('landmark') || c.includes('attraction')) return '#818cf8';
    if (c.includes('shop') || c.includes('market'))                               return '#ec4899';
    if (c.includes('hospital') || c.includes('pharmacy'))                         return '#60a5fa';
    return '#94a3b8';
}

// ─── NearbySection ────────────────────────────────────────────────────────────

function NearbySection({ coordinates }: { coordinates: { lat: number; lng: number } }) {
    const { gems } = useNearbyGems({ coordinates, category: 'all', radiusMeters: 2000 });
    const topGems  = gems.slice(0, 5);

    return (
        // The map over its list rather than beside it: in the design this
        // section is a column of its own next to the rooms, and a map given
        // 42% of *that* would be a thumbnail.
        <div>
            {/* Map — the column's full width, at the placeholder's proportions */}
            <div style={{ width: '100%', height: 360, borderRadius: 12, overflow: 'hidden', background: '#1e293b' }}>
                <Map
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    initialViewState={{ longitude: coordinates.lng, latitude: coordinates.lat, zoom: 14 }}
                    interactive={false}
                    className="rounded-2xl"
                >
                    {/* Hotel pin */}
                    <Marker longitude={coordinates.lng} latitude={coordinates.lat} anchor="center">
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: ACCENT, border: '2.5px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.55)' }} />
                    </Marker>
                    {/* POI pins */}
                    {topGems.map(gem => (
                        <Marker key={gem.id} longitude={gem.coordinates.lng} latitude={gem.coordinates.lat} anchor="center">
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: categoryDotColor(gem.category), border: '1.5px solid rgba(255,255,255,.75)', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
                        </Marker>
                    ))}
                </Map>
            </div>

            {/* Place list. The design shows only the map box, but the map is
                non-interactive and draws its places as unlabelled dots — on its
                own it says there is something nearby without saying what. The
                names and distances stay under it. */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
                {topGems.length === 0 && (
                    <p style={{ color: 'rgba(245,239,228,.3)', fontSize: 13 }}>Loading nearby places…</p>
                )}
                {topGems.map((gem, i) => {
                    const dist = haversine(coordinates.lat, coordinates.lng, gem.coordinates.lat, gem.coordinates.lng);
                    const Icon = gem.icon;
                    const dot  = categoryDotColor(gem.category);
                    return (
                        <div
                            key={gem.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '11px 0',
                                borderBottom: i < topGems.length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={15} color={dot} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#fff', lineHeight: 1.25 }}>{gem.name}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2, textTransform: 'capitalize' }}>
                                        {gem.displayCategory || gem.category}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(245,239,228,.55)', fontWeight: 600, paddingLeft: 12, flexShrink: 0 }}>
                                {dist.toFixed(1)} mi
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
    const [idx, setIdx] = useState(startIndex);

    const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length]);
    const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft')  prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, prev, next]);

    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            {/* Close */}
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}
            >
                <X size={18} />
            </button>

            {/* Counter */}
            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
                {idx + 1} / {images.length}
            </div>

            {/* Prev */}
            {images.length > 1 && (
                <button
                    onClick={e => { e.stopPropagation(); prev(); }}
                    style={{ position: 'absolute', left: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <ChevronLeft size={22} />
                </button>
            )}

            {/* Image */}
            <img
                src={images[idx]}
                alt=""
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '88vw', maxHeight: '84vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 24px 80px rgba(0,0,0,.7)', userSelect: 'none' }}
            />

            {/* Next */}
            {images.length > 1 && (
                <button
                    onClick={e => { e.stopPropagation(); next(); }}
                    style={{ position: 'absolute', right: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <ChevronRight size={22} />
                </button>
            )}

            {/* Dot indicators */}
            {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                    {images.map((_, i) => (
                        <div
                            key={i}
                            onClick={e => { e.stopPropagation(); setIdx(i); }}
                            style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, background: i === idx ? '#fff' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .2s' }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── PhotoGallery ─────────────────────────────────────────────────────────────
// Shows one featured photo; clicking it opens the lightbox for all images.

function PhotoGallery({ images }: { images: string[] }) {
    const [lightbox, setLightbox] = useState<number | null>(null);
    const [thumbFailed, setThumbFailed] = useState(false);

    // images[0] = hero (shown above); use images[1] as featured thumbnail
    const thumb = images[1];
    if (!thumb || thumbFailed) return null;

    return (
        <>
            <div
                onClick={() => setLightbox(1)}
                style={{ margin: '28px 0', borderRadius: 18, overflow: 'hidden', height: 280, position: 'relative', cursor: 'pointer' }}
            >
                <img
                    src={thumb}
                    alt=""
                    onError={() => setThumbFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .4s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
                {/* "View all" badge */}
                {images.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', pointerEvents: 'none' }}>
                        View all {images.length} photos
                    </div>
                )}
            </div>

            {lightbox !== null && (
                <Lightbox
                    images={images}
                    startIndex={lightbox}
                    onClose={() => setLightbox(null)}
                />
            )}
        </>
    );
}

// ─── PropertyContent ──────────────────────────────────────────────────────────

function PropertyContent() {
    const params       = useParams();
    const searchParams = useSearchParams();
    const router       = useRouter();

    const currency = useUserCurrency();

    const hotelId  = params.id as string;
    const checkIn  = searchParams.get('checkIn')  ?? '';
    const checkOut = searchParams.get('checkOut') ?? '';
    const adults   = Number(searchParams.get('adults')   ?? 2);
    const children = Number(searchParams.get('children') ?? 0);

    const [data, setData]     = useState<PropertyApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);
    const [saved, setSaved]   = useState(false);
    // { roomId → selected rate index }
    const [selectedRates, setSelectedRates] = useState<Record<string, number>>({});
    // Which room card is "booked" (user clicked Select)
    const [bookedRoomId, setBookedRoomId]   = useState<string | null>(null);

    useEffect(() => {
        if (!hotelId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const qs = new URLSearchParams();
        if (checkIn)   qs.set('checkIn',   checkIn);
        if (checkOut)  qs.set('checkOut',  checkOut);
        if (adults)    qs.set('adults',    String(adults));
        if (children)  qs.set('children',  String(children));

        http.get<PropertyApiResponse>(`/api/hotels/property/${hotelId}?${qs.toString()}`)
            .then(res  => { if (!cancelled) setData(res); })
            .catch(err => { if (!cancelled) setError(err.message ?? 'Failed to load property'); })
            .finally(()=> { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [hotelId, checkIn, checkOut, adults, children]);

    const content     = data?.content;
    const rooms       = data?.rooms ?? [];
    const reviewItems = (data?.reviewItems ?? []).slice(0, 4);
    const reviewScore = Number(data?.reviews?.rating ?? 0);
    const reviewCount = data?.reviews?.reviews_count ?? 0;
    const heroImage   = content?.images?.[0] ?? null;
    const allImages     = content?.images ?? [];
    const _galleryImages = allImages.slice(1); // images[0] is hero; lightbox gets all
    const amenities    = (content?.amenities ?? []).slice(0, 5);
    const nights       = (checkIn && checkOut)
        ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
        : null;
    // TGX returns total-stay price; divide by nights for per-night display
    const toNightly = (price: number, fromCurrency: string) =>
        convertCurrency(price, fromCurrency || 'USD', currency) / (nights ?? 1);

    const lowestPrice = rooms.length > 0
        ? Math.min(...rooms.flatMap(r => {
            const rates = (r.rates && r.rates.length > 0) ? r.rates : [{ price: r.price, currency: r.currency }];
            return rates.map(rt => toNightly(rt.price, rt.currency));
        }))
        : null;
    const coordinates  = (content?.lat && content?.lng) ? { lat: content.lat, lng: content.lng } : undefined;

    // Get the currently-highlighted rate for a given room
    function selectedRateFor(room: RoomOption): RateRow {
        const idx = selectedRates[room.id] ?? 0;
        const rates = room.rates ?? [];
        return rates[idx] ?? rates[0] ?? {
            offerId: room.offerId ?? room.id, price: room.price, currency: room.currency,
            refundable: false, refundableTag: 'NON_REFUNDABLE',
        };
    }

    const bookedRoom = bookedRoomId ? rooms.find(r => r.id === bookedRoomId) ?? null : null;
    const bookedRate = bookedRoom ? selectedRateFor(bookedRoom) : null;

    function goCheckout() {
        if (!bookedRoom || !bookedRate) return;
        const p = new URLSearchParams({
            hotelId,
            roomId:     bookedRoom.id,
            offerId:    bookedRate.offerId,
            rateKey:    bookedRate.offerId,
            currency:   bookedRate.currency,
            totalPrice: String(bookedRate.price),
            roomName:   bookedRoom.name,
            hotelName:  content?.name ?? 'Hotel',
        });
        if (checkIn)          p.set('checkIn',      checkIn);
        if (checkOut)         p.set('checkOut',     checkOut);
        if (adults)           p.set('adults',        String(adults));
        if (children)         p.set('children',      String(children));
        if (content?.address) p.set('hotelAddress',  content.address);
        if (content?.city)    p.set('hotelCity',     content.city);
        if (content?.country) p.set('hotelCountry',  content.country);
        if (allImages[0])     p.set('hotelImage',    allImages[0]);
        router.push(`/checkout?${p.toString()}`);
    }

    /**
     * No `fontFamily` here on purpose: the page inherits `font-sans` off the
     * body, which is what the search page does and what makes the two read as
     * one product.
     *
     * It used to name `--font-jakarta` — a *second* next/font instance of Plus
     * Jakarta Sans that the layout loads beside `--font-plus-jakarta`, the one
     * `font-sans` is bound to. Same family, separately hosted and separately
     * fetched, and pinned here at a fixed weight range while the shell's is
     * variable across 400–800. Inheriting drops the duplicate rather than
     * matching it.
     */
    const rootStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: BG,
        color: TEXT,
    };

    if (loading) {
        return (
            <div style={{ ...rootStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner />
            </div>
        );
    }

    if (error || !content) {
        return (
            <div style={{ ...rootStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
                <p style={{ color: 'rgba(245,239,228,.6)', textAlign: 'center' }}>{error ?? 'Property not found.'}</p>
                <button
                    onClick={() => router.back()}
                    style={{ padding: '10px 22px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div style={rootStyle}>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <div style={{ position: 'relative', height: '58vh', minHeight: 320, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden' }}>
                {heroImage ? (
                    <img
                        src={heroImage}
                        alt={content.name ?? ''}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, background: '#22383A' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(10,8,14,.15) 0%,rgba(10,8,14,.25) 45%,rgba(10,8,14,.85) 100%)' }} />

                {/* Name + location. The photo stays full-bleed; only the type
                    over it takes the column, so the hotel's name starts on the
                    same line as the price under it. */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 'clamp(20px,4vw,40px)' }}>
                    <PageColumn>
                        <div style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
                            {content.name}
                        </div>
                        {/* The street address, as the design has it, and only
                            falling back to city/country when the supplier sent
                            no address at all — the two together read as a
                            duplicate whenever the address already names the
                            city, which it usually does. */}
                        <div style={{ fontSize: 15, color: 'rgba(255,255,255,.9)', marginTop: 6, textShadow: '0 2px 12px rgba(0,0,0,.45)' }}>
                            {content.address || [content.city, content.country].filter(Boolean).join(', ')}
                        </div>
                    </PageColumn>
                </div>
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <PageColumn style={{ paddingTop: 'clamp(20px,4vw,40px)', paddingBottom: 140 }}>

                {/* Price + amenity chips */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255,255,255,.1)', paddingBottom: 20, marginBottom: 24 }}>
                    {lowestPrice !== null && (
                        <div>
                            <span style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
                                {formatCurrency(lowestPrice, currency)}
                            </span>
                            <span style={{ fontSize: 13, color: 'rgba(245,239,228,.5)' }}> /night</span>
                        </div>
                    </section>
                )}
                </div>

                {/* Photo gallery — thumb is images[1], lightbox shows all hotel images */}
                {allImages.length > 1 && <PhotoGallery images={allImages} />}

                {/* ── Room selection ─────────────────────────────────────────── */}
                {rooms.length > 0 && (
                    <div id="rooms-section" style={{ margin: '0 0 36px' }}>
                        <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: '#fff', marginBottom: 16 }}>
                            Choose your room
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {rooms.map(room => {
                                const isBooked  = room.id === bookedRoomId;
                                const roomPhotos = room.roomImages ?? [];
                                // Bed type lives in the parenthetical of the room name: "Standard Double room (full double bed)"
                                const bedTypeMatch = room.name.match(/\(([^)]+)\)$/);
                                const bedType = bedTypeMatch?.[1] ?? null;
                                // Clean name strips the parenthetical for the heading
                                const cleanName = room.name.replace(/\s*\([^)]+\)$/, '').trim();

                                // Fallback: synthesise a rate from room-level fields when rates is empty
                                const fallbackRate: import('@/features/hotels/types/property.types').RateRow = {
                                    offerId:    room.offerId ?? room.id,
                                    price:      room.price,
                                    currency:   room.currency,
                                    boardCode:  room.boardType,
                                    boardName:  room.boardName ?? 'Room only',
                                    refundable: room.refundableTag === 'REFUNDABLE',
                                    refundableTag: room.refundableTag ?? 'NON_REFUNDABLE',
                                    cancellationDeadline: room.cancellationDeadline,
                                };
                                const allRates   = (room.rates && room.rates.length > 0) ? room.rates : [fallbackRate];
                                const selRateIdx = selectedRates[room.id] ?? 0;
                                const selRate    = allRates[selRateIdx] ?? allRates[0];
                                const RATES_VISIBLE = 3;
                                const showAll      = (selectedRates[`${room.id}_expanded`] ?? 0) === 1;
                                const visibleRates = showAll ? allRates : allRates.slice(0, RATES_VISIBLE);
                                const hiddenCount  = allRates.length - RATES_VISIBLE;
                                const nightlySelRate = selRate ? toNightly(selRate.price, selRate.currency) : null;

                                return (
                                    <div
                                        key={room.id}
                                        style={{ display: 'flex', background: 'rgba(255,255,255,.04)', borderRadius: 18, border: isBooked ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,.1)', overflow: 'hidden', transition: 'border-color .2s', minHeight: 160 }}
                                    >
                                        {/* ── Left: photo stack ── */}
                                        <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', background: '#111' }}>
                                            {roomPhotos.length === 0 ? (
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.03)' }}>
                                                    <span style={{ fontSize: 28 }}>🛏</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ flex: roomPhotos.length >= 3 ? '0 0 66%' : 1, position: 'relative', overflow: 'hidden' }}>
                                                        <img src={roomPhotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                        {roomPhotos.length > 1 && (
                                                            <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>
                                                                📷 {roomPhotos.length}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {roomPhotos.length >= 2 && (
                                                        <div style={{ flex: '0 0 32%', overflow: 'hidden' }}>
                                                            <img src={roomPhotos[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* ── Middle: room info + rate table ── */}
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                            {/* Room name + specs */}
                                            <div style={{ padding: '14px 16px 10px' }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1.3 }}>{cleanName}</div>
                                                <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                                                    {bedType && (
                                                        <span style={{ fontSize: 11, color: 'rgba(245,239,228,.55)' }}>🛏 {bedType}</span>
                                                    )}
                                                    {adults > 0 && (
                                                        <span style={{ fontSize: 11, color: 'rgba(245,239,228,.55)' }}>👤 Sleeps {adults}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Rate rows */}
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', flex: 1 }}>
                                                {visibleRates.map((rate, idx) => {
                                                    const isSelected  = idx === selRateIdx;
                                                    const deadline    = rate.cancellationDeadline
                                                        ? new Date(rate.cancellationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        : null;

                                                    return (
                                                        <div
                                                            key={rate.offerId}
                                                            onClick={() => setSelectedRates(prev => ({ ...prev, [room.id]: idx }))}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', borderBottom: idx < visibleRates.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', background: isSelected ? 'rgba(255,107,75,.06)' : 'transparent', transition: 'background .15s', borderLeft: `2px solid ${isSelected ? ACCENT : 'transparent'}` }}
                                                        >
                                                            {/* Radio */}
                                                            <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${isSelected ? ACCENT : 'rgba(255,255,255,.2)'}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />}
                                                            </div>
                                                            {/* Info */}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{rate.boardName ?? 'Room only'}</span>
                                                                    <span style={{ fontSize: 11 }}>
                                                                        {rate.refundable
                                                                            ? <span style={{ color: GREEN }}>✓ Free cancel{deadline ? ` until ${deadline}` : ''}</span>
                                                                            : <span style={{ color: '#F59E0B' }}>⚠ Non-refundable</span>
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {(() => {
                                                                    const code = rate.boardCode ?? '';
                                                                    if (['FB', 'fullboard'].includes(code))       return <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>🍳 All meals included</div>;
                                                                    if (['HB', 'halfboard'].includes(code))       return <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>🍳 Breakfast + dinner</div>;
                                                                    if (['AI', 'allinclusive'].includes(code))    return <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>🍹 All inclusive</div>;
                                                                    if (['BB', 'CB', 'AB', 'EB', 'breakfast'].includes(code)) return <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>🍳 Breakfast included</div>;
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {hiddenCount > 0 && (
                                                    <button
                                                        onClick={() => setSelectedRates(prev => ({ ...prev, [`${room.id}_expanded`]: showAll ? 0 : 1 }))}
                                                        style={{ display: 'block', width: '100%', padding: '6px 16px', background: 'transparent', border: 'none', color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                                                    >
                                                        {showAll ? '↑ Fewer' : `↓ ${hiddenCount} more option${hiddenCount > 1 ? 's' : ''}`}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Right: price + button ── */}
                                        <div style={{ width: 130, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 14px', borderLeft: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
                                            {nightlySelRate !== null && (
                                                <>
                                                    <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>
                                                        {formatCurrency(nightlySelRate, currency)}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'rgba(245,239,228,.4)' }}>/night</div>
                                                </>
                                            )}
                                            <button
                                                onClick={() => setBookedRoomId(isBooked ? null : room.id)}
                                                style={{ marginTop: 4, padding: '9px 0', width: '100%', borderRadius: 100, border: 'none', background: isBooked ? GREEN : ACCENT, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                            >
                                                {isBooked ? '✓ Selected' : 'Choose room'}
                                            </button>
                                            {nights && (
                                                <div style={{ fontSize: 10, color: 'rgba(245,239,228,.3)', textAlign: 'center' }}>
                                                    {nights} night{nights > 1 ? 's' : ''} incl. taxes
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Guest reviews ──────────────────────────────────────────── */}
                {reviewItems.length > 0 && (
                    <div style={{ margin: '44px 0 0' }}>
                        <h2 className={cn(SECTION_HEADING, 'mb-4 text-white')}>What guests say</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                            {reviewItems.map((rev, i) => {
                                const score = Number(rev.score ?? 0);
                                const ri    = ratingInfo(score);
                                const blurb = rev.pros || rev.headline || 'Great stay';
                                return (
                                    <div
                                        key={i}
                                        style={{ flex: '1 1 260px', background: 'rgba(255,255,255,.04)', borderRadius: 18, padding: 20, position: 'relative', transform: `rotate(${i % 2 === 0 ? '-0.5deg' : '0.5deg'})`, border: '1px solid rgba(255,255,255,.08)' }}
                                    >
                                        {score > 0 && (
                                            <div style={{ position: 'absolute', top: -12, right: 16, background: ri.color, color: '#fff', fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 10, border: '2px dashed rgba(255,255,255,.5)' }}>
                                                {score.toFixed(1)}
                                            </div>
                                        )}
                                        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(245,239,228,.85)', margin: '0 0 12px' }}>
                                            &ldquo;{blurb}&rdquo;
                                        </p>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{rev.reviewer_name ?? 'Guest'}</div>
                                        {rev.country && <div style={{ fontSize: 11, color: 'rgba(245,239,228,.5)' }}>{rev.country}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </PageColumn>

            {/* ── Fixed bottom bar ──────────────────────────────────────────── */}
            {/* The bar itself still spans the window — it is the page's edge
                the fill belongs to, not the column's — but what it holds takes
                the column, so the price sits under the price above it and the
                button under the right edge of everything else. */}
            <div
                className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30"
                style={{ background: 'rgba(21,17,30,.96)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,.1)', padding: '14px 0' }}
            >
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'rgba(245,239,228,.5)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                        {bookedRoom ? 'Selected room' : 'Starting from'}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bookedRoom && bookedRate
                            ? `${bookedRoom.name} · ${formatCurrency(toNightly(bookedRate.price, bookedRate.currency), currency)}/night`
                            : lowestPrice !== null
                                ? `${formatCurrency(lowestPrice, currency)}/night`
                                : '—'}
                    </div>
                </div>
                {bookedRoom ? (
                    <button
                        onClick={goCheckout}
                        style={{ padding: '12px 22px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        Continue to checkout
                    </button>
                ) : (
                    <a
                        href="#rooms-section"
                        style={{ padding: '12px 22px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        Check rooms ↓
                    </a>
                )}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HotelPropertyPage() {
    return (
        <Suspense
            fallback={
                <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner />
                </div>
            }
        >
            <PropertyContent />
        </Suspense>
    );
}
