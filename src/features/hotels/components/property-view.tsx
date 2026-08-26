'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertCurrency, getCurrencySymbol, EXCHANGE_RATES } from '@/shared/lib/currency';
import { HOTEL_TOKENS, ratingInfo } from '@/features/hotels/types/property.types';
import type { PropertyApiResponse } from '@/features/hotels/types/property.types';
import { PropertyHero } from '@/features/hotels/components/property-hero';
import { ReviewSection } from '@/features/hotels/components/review-section';
import { RoomSelector } from '@/features/hotels/components/room-selector';
import { NearbySection } from '@/features/hotels/components/nearby-section';

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
            <style>{`/keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
            <circle cx="12" cy="12" r="9" fill="none" stroke={HOTEL_TOKENS.ACCENT} strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
        </svg>
    );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
    const [idx, setIdx] = useState(startIndex);

    const prev = useCallback(() => setIdx((i) => (i - 1 + images.length) % images.length), [images.length]);
    const next = useCallback(() => setIdx((i) => (i + 1) % images.length), [images.length]);

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
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
                <X size={18} />
            </button>
            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
                {idx + 1} / {images.length}
            </div>
            {images.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); prev(); }} style={{ position: 'absolute', left: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft size={22} />
                </button>
            )}
            <img src={images[idx]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '88vw', maxHeight: '84vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 24px 80px rgba(0,0,0,.7)', userSelect: 'none' }} />
            {images.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); next(); }} style={{ position: 'absolute', right: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronRight size={22} />
                </button>
            )}
            {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                    {images.map((_, i) => (
                        <div key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, background: i === idx ? '#fff' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .2s' }} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── PhotoGallery ─────────────────────────────────────────────────────────────

function PhotoGallery({ images }: { images: string[] }) {
    const [lightbox, setLightbox] = useState<number | null>(null);
    const [thumbFailed, setThumbFailed] = useState(false);
    const thumb = images[1];
    if (!thumb || thumbFailed) return null;

    return (
        <>
            <div onClick={() => setLightbox(1)} style={{ margin: '28px 0', borderRadius: 18, overflow: 'hidden', height: 280, position: 'relative', cursor: 'pointer' }}>
                <img src={thumb} alt="" onError={() => setThumbFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .4s' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')} onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')} />
                {images.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', pointerEvents: 'none' }}>
                        View all {images.length} photos
                    </div>
                )}
            </div>
            {lightbox !== null && <Lightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />}
        </>
    );
}

// ─── PropertyView ─────────────────────────────────────────────────────────────

export function PropertyView() {
    const params       = useParams();
    const searchParams = useSearchParams();
    const router       = useRouter();

    const hotelId  = params.id as string;
    const checkIn  = searchParams.get('checkIn')  ?? '';
    const checkOut = searchParams.get('checkOut') ?? '';
    const adults   = Number(searchParams.get('adults')   ?? 2);
    const children = Number(searchParams.get('children') ?? 0);

    const [data, setData]                     = useState<PropertyApiResponse | null>(null);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [saved, setSaved]                   = useState(false);

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
            .then((res)  => { if (!cancelled) setData(res); })
            .catch((err) => { if (!cancelled) setError(err.message ?? 'Failed to load property'); })
            .finally(()  => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [hotelId, checkIn, checkOut, adults, children]);

    const userCurrency = useUserCurrency();
    const content      = data?.content;
    const rooms        = data?.rooms ?? [];
    const reviewItems  = (data?.reviewItems ?? []).slice(0, 4);
    const reviewScore  = Number(data?.reviews?.rating ?? 0);
    const reviewCount  = data?.reviews?.reviews_count ?? 0;
    const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
    const allImages    = content?.images ?? [];
    const amenities    = (Array.isArray(content?.amenities) ? content!.amenities as string[] : []).slice(0, 5);
    const lowestPrice  = rooms.length > 0 ? Math.min(...rooms.map((r) => r.price)) : null;
    const coordinates  = (content?.lat && content?.lng) ? { lat: content.lat, lng: content.lng } : undefined;
    const nights       = (checkIn && checkOut)
        ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
        : null;

    const fmt = (amount: number, fromCurrency: string): string => {
        const to    = userCurrency || 'USD';
        const from  = (fromCurrency || 'USD').toUpperCase();
        const known = from in EXCHANGE_RATES && to in EXCHANGE_RATES;
        const value = known ? convertCurrency(amount, from, to) : amount;
        const sym   = getCurrencySymbol(known ? to : from);
        return `${sym}${Math.round(value).toLocaleString()}`;
    };

    function goCheckout() {
        if (!selectedRoom || !content) return;
        const p = new URLSearchParams({
            hotelId,
            roomId:     selectedRoom.id,
            offerId:    selectedRoom.offerId ?? selectedRoom.id,
            rateKey:    selectedRoom.offerId ?? selectedRoom.id,
            currency:   selectedRoom.currency,
            totalPrice: String(nights ? selectedRoom.price * nights : selectedRoom.price),
            roomName:   selectedRoom.name,
            hotelName:  content.name ?? 'Hotel',
        });
        if (checkIn)          p.set('checkIn',      checkIn);
        if (checkOut)         p.set('checkOut',     checkOut);
        if (adults)           p.set('adults',        String(adults));
        if (children)         p.set('children',      String(children));
        if (content.address)  p.set('hotelAddress',  content.address);
        if (content.city)     p.set('hotelCity',     content.city);
        if (content.country)  p.set('hotelCountry',  content.country);
        if (allImages[0])     p.set('hotelImage',    allImages[0]);
        router.push(`/checkout?${p.toString()}`);
    }

    const rootStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: HOTEL_TOKENS.BG,
        color: HOTEL_TOKENS.TEXT,
        fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
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
                <button onClick={() => router.back()} style={{ padding: '10px 22px', borderRadius: 100, border: 'none', background: HOTEL_TOKENS.ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div style={rootStyle}>
            <PropertyHero
                name={content.name ?? ''}
                city={content.city}
                country={content.country}
                heroImage={allImages[0] ?? null}
                reviewScore={reviewScore}
                reviewCount={reviewCount}
                saved={saved}
                onBack={() => router.back()}
                onSave={() => setSaved((s) => !s)}
            />

            <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px,4vw,40px)', paddingBottom: 140 }}>

                {/* Price + amenity chips */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255,255,255,.1)', paddingBottom: 20, marginBottom: 24 }}>
                    {lowestPrice !== null && (
                        <div>
                            <span style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
                                {fmt(lowestPrice, rooms[0]?.currency ?? 'USD')}
                            </span>
                            <span style={{ fontSize: 13, color: 'rgba(245,239,228,.5)' }}> /night</span>
                        </div>
                    )}
                    {amenities.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {amenities.map((am) => (
                                <div key={am} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.06)', borderRadius: 100, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: HOTEL_TOKENS.TEXT }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: HOTEL_TOKENS.ACCENT, display: 'inline-block', flexShrink: 0 }} />
                                    {am}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Description */}
                {content.description && (
                    <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(245,239,228,.82)', margin: '0 0 8px' }}>
                        {content.description.slice(0, 300)}{content.description.length > 300 ? '…' : ''}
                    </p>
                )}

                {/* Photo gallery */}
                {allImages.length > 1 && <PhotoGallery images={allImages} />}

                {/* Room selection */}
                {rooms.length > 0 && (
                    <div id="rooms-section" style={{ margin: '0 0 36px' }}>
                        <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: '#fff', marginBottom: 16 }}>
                            Choose your room
                        </div>
                        <RoomSelector
                            rooms={rooms}
                            selectedRoomId={selectedRoomId}
                            onSelect={setSelectedRoomId}
                        />
                    </div>
                )}

                {/* Guest reviews */}
                <ReviewSection
                    hotelId={hotelId}
                    reviewScore={reviewScore}
                    reviewCount={reviewCount}
                    reviewItems={reviewItems}
                />

                {/* Nearby */}
                {coordinates && (
                    <div style={{ margin: '36px 0 0' }}>
                        <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: '#fff', marginBottom: 16 }}>
                            Nearby
                        </div>
                        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', padding: 16 }}>
                            <NearbySection coordinates={coordinates} />
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed bottom bar */}
            <div
                className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-30"
                style={{ background: 'rgba(21,17,30,.96)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,.1)', padding: '14px clamp(16px,4vw,40px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
            >
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'rgba(245,239,228,.5)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                        {selectedRoom ? 'Selected room' : 'Starting from'}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedRoom
                            ? `${selectedRoom.name} · ${fmt(selectedRoom.price, selectedRoom.currency ?? 'USD')}/night`
                            : lowestPrice !== null
                                ? `${fmt(lowestPrice, rooms[0]?.currency ?? 'USD')}/night`
                                : '—'}
                    </div>
                </div>
                {selectedRoom ? (
                    <button onClick={goCheckout} style={{ padding: '12px 22px', borderRadius: 100, border: 'none', background: HOTEL_TOKENS.ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        Continue to checkout
                    </button>
                ) : (
                    <a href="#rooms-section" style={{ padding: '12px 22px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        Check rooms ↓
                    </a>
                )}
            </div>
        </div>
    );
}
