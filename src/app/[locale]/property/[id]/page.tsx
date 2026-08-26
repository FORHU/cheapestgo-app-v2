'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Marker } from 'react-map-gl/mapbox';
import { http } from '@/shared/lib/http';
import { Map } from '@/shared/components/ui/map';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
import { PropertyDescription } from '@/features/hotels/components/property-description';
import { cn } from '@/shared/lib/cn';
import { SECTION_HEADING, SHELL_CAP, SHELL_GUTTER } from '@/shared/lib/layout';
import { RoomSelection, ratesOf, type SelectedOffer } from '@/features/hotels/components/room-selection';
import { useUserCurrency } from '@/stores/searchStore';
import { convertCurrency } from '@/shared/lib/currency';
import { formatCurrency } from '@/shared/lib/format';
import type { RoomOption } from '@/features/hotels/types/property.types';

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

/** The banner's prev/next buttons, which differ only in which edge they sit on. */
const HERO_ARROW: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
    width: 44, height: 44, borderRadius: '50%',
    // border: '1px solid rgba(255,255,255,.25)',
    background: 'rgba(20,20,20,.45)', backdropFilter: 'blur(8px)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
};

/** Past this many photographs the dots become a counter — see the banner. */
const HERO_DOTS_MAX = 8;

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
                    <p style={{ color: 'rgba(245,239,228,.3)', fontSize: 18 }}>Loading nearby places…</p>
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
                                    <Icon size={21} color={dot} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', lineHeight: 1.25 }}>{gem.name}</div>
                                    <div style={{ fontSize: 15, color: 'rgba(245,239,228,.45)', marginTop: 2, textTransform: 'capitalize' }}>
                                        {gem.displayCategory || gem.category}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 17, color: 'rgba(245,239,228,.55)', fontWeight: 600, paddingLeft: 12, flexShrink: 0 }}>
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
            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
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
                    <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 17, fontWeight: 700, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', pointerEvents: 'none' }}>
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

    const hotelId  = params.id as string;
    const checkIn  = searchParams.get('checkIn')  ?? '';
    const checkOut = searchParams.get('checkOut') ?? '';
    const adults   = Number(searchParams.get('adults')   ?? 2);
    const children = Number(searchParams.get('children') ?? 0);

    /** Everything with a price on this page is drawn in the guest's own
     *  currency, not whichever one the supplier happened to quote in. */
    const currency = useUserCurrency();

    const [data, setData]                     = useState<PropertyApiResponse | null>(null);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState<string | null>(null);
    /**
     * The offer the guest picked — a room *and* one of its rates.
     * `selectedRoomId` was not enough: the same room comes back several
     * times over at different boards and prices, and only the rate carries
     * the `offerId` that checkout books against.
     */
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    /** Which of the banner images is showing. */
    const [heroIndex, setHeroIndex] = useState(0);

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

    const content      = data?.content;
    const rooms        = data?.rooms ?? [];
    const reviewItems  = (data?.reviewItems ?? []).slice(0, 4);
    const reviewScore  = Number(data?.reviews?.rating ?? 0);
    const selectedRoom = selectedOffer?.room ?? null;
    const selectedRate = selectedOffer?.rate ?? null;
    const heroImage     = content?.images?.[0] ?? null;
    const allImages     = content?.images ?? [];
    /**
     * What the banner pages through: the hotel's own photographs, then every
     * room shot the supplier sent.
     *
     * The room shots used to sit one-per-card, where a card has room for
     * exactly one of them and no way to see the rest. Here a set of six for a
     * single room is something you can actually look through — and the cards
     * keep the hotel photo, which is what they were showing most of the time
     * anyway.
     *
     * De-duplicated because a supplier that has one photograph tends to return
     * it as both the hotel's and the room's.
     */
    const heroImages = useMemo<string[]>(() => {
        const roomShots = rooms.flatMap(r => r.roomImages ?? []);
        return Array.from(new Set([...allImages, ...roomShots])).filter(Boolean);
    }, [allImages, rooms]);
    const heroCount = heroImages.length;
    // Clamped rather than trusted: the rooms arrive after the content does, so
    // the set grows under an index that has already been moved.
    const heroShown = heroImages[Math.min(heroIndex, Math.max(0, heroCount - 1))] ?? heroImage;
    const _galleryImages = allImages.slice(1); // images[0] is hero; lightbox gets all
    // Whole list, not the first five: the description panel draws the row the
    // design shows and keeps the rest behind its own "See all amenities".
    const amenities    = content?.amenities ?? [];

    const coordinates  = (content?.lat && content?.lng) ? { lat: content.lat, lng: content.lng } : undefined;
    const nights       = (checkIn && checkOut)
        ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
        : null;

    /**
     * A supplier price, as the page shows it: the whole stay converted into
     * the guest's own currency, then divided down to one night.
     *
     * TGX quotes the stay, not the night. Printing that figure beside
     * "/night" was overstating every rate by the length of the trip.
     */
    const toNightly = (price: number, from: string) =>
        convertCurrency(price, from || 'USD', currency) / Math.max(1, nights ?? 1);

    /**
     * The cheapest night on offer, across every rate of every room — off
     * `ratesOf`, the same list the cards are built from, so the figure in
     * the header is one a card below it actually shows.
     */
    const lowestPrice = rooms.length > 0
        ? Math.min(...rooms.flatMap(r => ratesOf(r).map(rate => toNightly(rate.price, rate.currency))))
        : null;

    function goCheckout() {
        if (!selectedRoom || !selectedRate) return;
        const p = new URLSearchParams({
            hotelId,
            roomId:     selectedRoom.id,
            offerId:    selectedRate.offerId,
            rateKey:    selectedRate.offerId,
            // The rate's own figures, untouched: it is quoted for the whole
            // stay in the supplier's currency, and that is what is booked.
            // The conversion above is for display only.
            currency:   selectedRate.currency,
            totalPrice: String(selectedRate.price),
            roomName:   selectedRoom.name,
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
                    style={{ padding: '10px 22px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 20, cursor: 'pointer' }}
                >
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div style={rootStyle}>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <div style={{ position: 'relative', height: '84vh', minHeight: 320, overflow: 'hidden' }}>
                {heroShown ? (
                    <img
                        key={heroShown}
                        src={heroShown}
                        alt={content.name ?? ''}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, background: '#22383A' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(10,8,14,.15) 0%,rgba(10,8,14,.25) 45%,rgba(10,8,14,.85) 100%)' }} />

                {/* Back. Over the photo rather than in the page below it — the
                    banner is the first thing on screen, and a control to leave
                    should not be something you scroll to find. */}
                <button
                    onClick={() => router.back()}
                    aria-label="Go back"
                    style={{
                        position: 'absolute', top: 20, left: 20, zIndex: 2,
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'rgba(20,20,20,.45)', backdropFilter: 'blur(8px)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Pagination. Only once there is more than one photograph to
                    page through — a single-image banner with arrows and a lone
                    dot is chrome promising something it cannot do. */}
                {heroCount > 1 && (
                    <>
                        <button
                            onClick={() => setHeroIndex(i => (i - 1 + heroCount) % heroCount)}
                            aria-label="Previous photo"
                            style={{ ...HERO_ARROW, left: 20 }}
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <button
                            onClick={() => setHeroIndex(i => (i + 1) % heroCount)}
                            aria-label="Next photo"
                            style={{ ...HERO_ARROW, right: 20 }}
                        >
                            <ChevronRight size={22} />
                        </button>

                        {/* Dots. Capped: a hotel with forty photographs would
                            otherwise draw forty targets too small to hit, so
                            past the cap the strip becomes a counter. */}
                        <div style={{ position: 'absolute', bottom: 'clamp(96px,12vw,150px)', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, zIndex: 2 }}>
                            {heroCount <= HERO_DOTS_MAX ? (
                                heroImages.map((src, i) => (
                                    <button
                                        key={src}
                                        onClick={() => setHeroIndex(i)}
                                        aria-label={`Photo ${i + 1} of ${heroCount}`}
                                        aria-current={i === heroIndex || undefined}
                                        style={{
                                            width: i === heroIndex ? 26 : 8, height: 8, borderRadius: 4,
                                            border: 'none', padding: 0, cursor: 'pointer',
                                            background: i === heroIndex ? '#fff' : 'rgba(255,255,255,.45)',
                                            transition: 'width .2s ease, background .2s ease',
                                        }}
                                    />
                                ))
                            ) : (
                                <span style={{
                                    fontSize: 14, fontWeight: 600, color: '#fff',
                                    background: 'rgba(20,20,20,.5)', backdropFilter: 'blur(8px)',
                                    borderRadius: 100, padding: '4px 12px',
                                }}>
                                    {Math.min(heroIndex, heroCount - 1) + 1} / {heroCount}
                                </span>
                            )}
                        </div>
                    </>
                )}

                {/* Name + location. The photo stays full-bleed; only the type
                    over it takes the column, so the hotel's name starts on the
                    same line as the price under it. */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 'clamp(20px,4vw,40px)' }}>
                    <PageColumn>
                        <div style={{ fontWeight: 500, fontSize: 'clamp(36px,4.8vw,53px)', letterSpacing: '-0.02em', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
                            {content.name}
                        </div>
                        {/* The street address, as the design has it, and only
                            falling back to city/country when the supplier sent
                            no address at all — the two together read as a
                            duplicate whenever the address already names the
                            city, which it usually does. */}
                        <div style={{ fontSize: 21, color: 'rgba(255,255,255,.9)', marginTop: 6, textShadow: '0 2px 12px rgba(0,0,0,.45)' }}>
                            {content.address || [content.city, content.country].filter(Boolean).join(', ')}
                        </div>
                    </PageColumn>
                </div>
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <PageColumn style={{ paddingTop: 'clamp(20px,4vw,40px)', paddingBottom: 140 }}>

                {/* ── Description ────────────────────────────────────────────
                    The rate, the desk's hours, what the stay comes with, and
                    the supplier's own write-up — drawn straight onto the page
                    ground, with no plate of its own, as the design has it.

                    It replaces two blocks that were the same information split
                    across the page and half-told: a price row whose chips
                    stopped at five amenities with no way to reach the rest, and
                    a paragraph cut at 300 characters with an ellipsis and no
                    way to open it. Both now disclose in place.

                    `tone="dark"` because this page paints itself dark from
                    `rootStyle` rather than from the app theme — the section
                    would otherwise come up light under a light theme, on a
                    black ground, with cream text around it. */}
                <PropertyDescription
                    className="mb-8"
                    tone="dark"
                    price={lowestPrice}
                    currency={currency}
                    rating={reviewScore}
                    checkInTime={content.check_in_time ?? content.check_in}
                    checkOutTime={content.check_out_time ?? content.check_out}
                    amenities={amenities}
                    description={content.description}
                />

                {/* ── Rooms, and what is around them ─────────────────────────
                    One row of two columns, as the design lays it out: the rate
                    stack on the left at roughly five parts to the map's four,
                    stacking under it below `lg` where neither half has the
                    width to be half of anything. */}
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-12">

                {/* ── Room selection ─────────────────────────────────────────
                    The design's own section: a filter row over a stack of
                    plates, each carrying a photo, the rate's features and its
                    price. It replaces a hand-rolled list with no filters, no
                    photo, and a rate's features shown as at most two badges.

                    The photo is the hotel's own — suppliers return rates, not
                    room photography — which is why one picture runs across the
                    cards rather than a different one per room. The amenity list
                    is the hotel's for the same reason, and is read only by rates
                    that carry none of their own. */}
                <RoomSelection
                    id="rooms-section"
                    className="min-w-0"
                    tone="dark"
                    rooms={rooms}
                    image={heroImage}
                    hotelAmenities={amenities}
                    nights={nights}
                    currency={currency}
                    selectedOfferId={selectedRate?.offerId ?? null}
                    onSelect={(offer) => setSelectedOffer(
                        prev => prev?.rate.offerId === offer.rate.offerId ? null : offer,
                    )}
                />

                {/* ── Nearby places ────────────────────────────────────────── */}
                {coordinates && (
                    <section className="min-w-0">
                        <h2 className={cn(SECTION_HEADING, 'text-white')}>Nearby Places</h2>
                        <div className="mt-4">
                            <NearbySection coordinates={coordinates} />
                        </div>
                    )}
                </div>

                {/* Photo gallery — thumb is images[1], lightbox shows all hotel images */}
                {allImages.length > 1 && <PhotoGallery images={allImages} />}

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
                                            <div style={{ position: 'absolute', top: -12, right: 16, background: ri.color, color: '#fff', fontSize: 17, fontWeight: 800, padding: '5px 10px', borderRadius: 10, border: '2px dashed rgba(255,255,255,.5)' }}>
                                                {score.toFixed(1)}
                                            </div>
                                        )}
                                        <p style={{ fontSize: 20, lineHeight: 1.55, color: 'rgba(245,239,228,.85)', margin: '0 0 12px' }}>
                                            &ldquo;{blurb}&rdquo;
                                        </p>
                                        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{rev.reviewer_name ?? 'Guest'}</div>
                                        {rev.country && <div style={{ fontSize: 15, color: 'rgba(245,239,228,.5)' }}>{rev.country}</div>}
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
                <PageColumn>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 15, color: 'rgba(245,239,228,.5)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                                {selectedRoom ? 'Selected room' : 'Starting from'}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {/* The same figure the card shows: per night, in
                                    the guest's currency. It used to print the
                                    supplier's total-stay price against "/night",
                                    which disagreed with the card above it and
                                    overstated the rate by the length of the trip. */}
                                {selectedRoom && selectedRate
                                    ? `${selectedRoom.name} · ${formatCurrency(toNightly(selectedRate.price, selectedRate.currency), currency)}/night`
                                    : lowestPrice !== null
                                        ? `${formatCurrency(lowestPrice, currency)}/night`
                                        : '—'}
                            </div>
                        </div>
                        {selectedRoom ? (
                            <button
                                onClick={goCheckout}
                                style={{ padding: '12px 22px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 20, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                            >
                                Continue to checkout
                            </button>
                        ) : (
                            <a
                                href="#rooms-section"
                                style={{ padding: '12px 22px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 20, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
                            >
                                Check rooms ↓
                            </a>
                        )}
                    </div>
                </PageColumn>
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
