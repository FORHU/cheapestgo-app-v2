'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { http } from '@/shared/lib/http';
import type { RoomOption } from '@/features/hotels/components/room-list';
import dynamic from 'next/dynamic';

const PoiDiscovery = dynamic(
    () => import('@/features/hotels/components/poi-discovery').then(m => m.PoiDiscovery),
    { ssr: false }
);

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
const GREEN = '#2FB67F';
const TEXT = '#F5EFE4';
const BG = 'linear-gradient(180deg,#15111E,#1B1526)';

function ratingInfo(score: number): { label: string; color: string } {
    if (score >= 9) return { label: 'Exceptional', color: GREEN };
    if (score >= 8) return { label: 'Excellent', color: '#4FA8E0' };
    return { label: 'Good', color: '#E0A23C' };
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

// ─── Inner page content ───────────────────────────────────────────────────────

function PropertyContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const hotelId  = params.id as string;
    const checkIn  = searchParams.get('checkIn')  ?? '';
    const checkOut = searchParams.get('checkOut') ?? '';
    const adults   = Number(searchParams.get('adults')   ?? 2);
    const children = Number(searchParams.get('children') ?? 0);

    const [data, setData]           = useState<PropertyApiResponse | null>(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [saved, setSaved]         = useState(false);

    useEffect(() => {
        if (!hotelId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const qs = new URLSearchParams();
        if (checkIn)   qs.set('checkIn', checkIn);
        if (checkOut)  qs.set('checkOut', checkOut);
        if (adults)    qs.set('adults', String(adults));
        if (children)  qs.set('children', String(children));

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
    const reviewCount  = data?.reviews?.reviews_count ?? 0;
    const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;
    const heroImage    = content?.images?.[0] ?? null;
    const amenities    = (content?.amenities ?? []).slice(0, 5);
    const lowestPrice  = rooms.length > 0 ? Math.min(...rooms.map(r => r.price)) : null;
    const coordinates  = (content?.lat && content?.lng)
        ? { lat: content.lat, lng: content.lng }
        : undefined;

    const nights = (checkIn && checkOut)
        ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
        : null;

    function goCheckout() {
        if (!selectedRoom) return;
        const p = new URLSearchParams({
            hotelId,
            roomId:     selectedRoom.id,
            offerId:    selectedRoom.offerId ?? selectedRoom.id,
            rateKey:    selectedRoom.offerId ?? selectedRoom.id,
            currency:   selectedRoom.currency,
            totalPrice: String(nights ? selectedRoom.price * nights : selectedRoom.price),
            roomName:   selectedRoom.name,
            hotelName:  content?.name ?? 'Hotel',
        });
        if (checkIn)   p.set('checkIn', checkIn);
        if (checkOut)  p.set('checkOut', checkOut);
        if (adults)    p.set('adults', String(adults));
        if (children)  p.set('children', String(children));
        router.push(`/checkout?${p.toString()}`);
    }

    const rootStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ ...rootStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner />
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error || !content) {
        return (
            <div style={{ ...rootStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
                <p style={{ color: 'rgba(245,239,228,.6)', textAlign: 'center' }}>{error ?? 'Property not found.'}</p>
                <button
                    onClick={() => router.back()}
                    style={{ padding: '10px 22px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-jakarta)" }}
                >
                    Go back
                </button>
            </div>
        );
    }

    const rinfo = ratingInfo(reviewScore);

    return (
        <div style={rootStyle}>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <div style={{ position: 'relative', height: '58vh', minHeight: 320 }}>
                {heroImage ? (
                    <img
                        src={heroImage}
                        alt={content.name ?? ''}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, background: '#22383A' }} />
                )}
                {/* Gradient overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(10,8,14,.15) 0%,rgba(10,8,14,.25) 45%,rgba(10,8,14,.85) 100%)' }} />

                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    aria-label="Back"
                    style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <ArrowLeft size={16} />
                </button>

                {/* Heart */}
                <button
                    onClick={() => setSaved(s => !s)}
                    aria-label={saved ? 'Unsave' : 'Save'}
                    style={{ position: 'absolute', top: 20, right: reviewScore > 0 ? 90 : 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <Heart size={18} fill={saved ? ACCENT : 'none'} stroke={saved ? ACCENT : '#fff'} />
                </button>

                {/* Rating stamp */}
                {reviewScore > 0 && (
                    <div style={{ position: 'absolute', top: 20, right: 20, width: 58, height: 58, borderRadius: '50%', background: rinfo.color, color: '#fff', border: '2px dashed rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{reviewScore.toFixed(1)}</div>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 1 }}>{rinfo.label}</div>
                    </div>
                )}

                {/* Property name at bottom of hero */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'clamp(20px,4vw,40px)' }}>
                    <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 'clamp(26px,4vw,44px)', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
                        {content.name}
                    </div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', marginTop: 6 }}>
                        {[content.city, content.country].filter(Boolean).join(' · ')}
                        {reviewCount > 0 ? ` · ${reviewCount.toLocaleString()} reviews` : ''}
                    </div>
                </div>
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px,4vw,40px)', paddingBottom: 140 }}>

                {/* Price + amenity chips */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255,255,255,.1)', paddingBottom: 20, marginBottom: 24 }}>
                    {lowestPrice !== null && (
                        <div>
                            <span style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
                                {rooms[0]?.currency} {lowestPrice.toLocaleString()}
                            </span>
                            <span style={{ fontSize: 13, color: 'rgba(245,239,228,.5)' }}> /night</span>
                        </div>
                    )}
                    {amenities.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {amenities.map(am => (
                                <div key={am} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.06)', borderRadius: 100, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: TEXT }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block', flexShrink: 0 }} />
                                    {am}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Description */}
                {content.description && (
                    <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(245,239,228,.82)', margin: '0 0 32px' }}>
                        {content.description}
                    </p>
                )}

                {/* ── Room selection ─────────────────────────────────────────── */}
                {rooms.length > 0 && (
                    <div id="rooms-section" style={{ margin: '0 0 36px' }}>
                        <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: '#fff', marginBottom: 16 }}>
                            Choose your room
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {rooms.map(room => {
                                const selected     = room.id === selectedRoomId;
                                const isRefundable = room.refundableTag === 'RFN';
                                const hasBreakfast = ['BB', 'HB', 'FB', 'AI'].includes(room.boardType ?? '');
                                const bedLabel     = [room.bedType, room.size ? `${room.size}m²` : null].filter(Boolean).join(' · ');

                                return (
                                    <div
                                        key={room.id}
                                        onClick={() => setSelectedRoomId(selected ? null : room.id)}
                                        style={{ display: 'flex', background: 'rgba(255,255,255,.04)', borderRadius: 16, border: selected ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,.1)', cursor: 'pointer', overflow: 'hidden', transition: 'border-color .2s' }}
                                    >
                                        {/* Info column */}
                                        <div style={{ flex: 1, minWidth: 0, padding: '16px 18px' }}>
                                            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{room.name}</div>
                                            {bedLabel && <div style={{ fontSize: 12, color: 'rgba(245,239,228,.55)', marginTop: 3 }}>{bedLabel}</div>}
                                            {(hasBreakfast || isRefundable) && (
                                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                                    {hasBreakfast && (
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, background: 'rgba(255,255,255,.08)', padding: '3px 9px', borderRadius: 8 }}>
                                                            Breakfast included
                                                        </span>
                                                    )}
                                                    {isRefundable && (
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: GREEN, background: 'rgba(47,182,127,.15)', padding: '3px 9px', borderRadius: 8 }}>
                                                            Free cancellation
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Dashed perforation */}
                                        <div style={{ width: 1, flexShrink: 0, background: 'repeating-linear-gradient(to bottom,rgba(255,255,255,.2) 0 6px,transparent 6px 12px)' }} />

                                        {/* Price + select */}
                                        <div style={{ width: 140, flexShrink: 0, padding: '16px 18px', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
                                            <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>
                                                {room.currency} {room.price.toLocaleString()}
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); setSelectedRoomId(selected ? null : room.id); }}
                                                style={{ padding: '8px 16px', borderRadius: 100, border: 'none', background: selected ? GREEN : ACCENT, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "var(--font-jakarta)" }}
                                            >
                                                {selected ? 'Selected' : 'Select'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Guest reviews ──────────────────────────────────────────── */}
                {reviewItems.length > 0 && (
                    <div style={{ margin: '36px 0' }}>
                        <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: '#fff', marginBottom: 16 }}>
                            What guests say
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                            {reviewItems.map((rev, i) => {
                                const score = Number(rev.score ?? 0);
                                const ri    = ratingInfo(score);
                                const blurb = rev.pros || rev.headline || 'Great stay';
                                return (
                                    <div key={i} style={{ flex: '1 1 260px', background: 'rgba(255,255,255,.04)', borderRadius: 18, padding: 20, position: 'relative', transform: `rotate(${i % 2 === 0 ? '-0.5deg' : '0.5deg'})`, border: '1px solid rgba(255,255,255,.08)' }}>
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

                {/* ── Nearby ────────────────────────────────────────────────── */}
                {coordinates && (
                    <div style={{ margin: '36px 0 0' }}>
                        <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: '#fff', marginBottom: 16 }}>
                            Nearby
                        </div>
                        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden', padding: 4 }}>
                            <PoiDiscovery coordinates={coordinates} />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Fixed bottom bar ──────────────────────────────────────────── */}
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
                            ? `${selectedRoom.name} · ${selectedRoom.currency} ${selectedRoom.price.toLocaleString()}/night`
                            : lowestPrice !== null
                                ? `${rooms[0]?.currency ?? ''} ${lowestPrice.toLocaleString()}/night`
                                : '—'}
                    </div>
                </div>

                {selectedRoom ? (
                    <button
                        onClick={goCheckout}
                        style={{ padding: '12px 22px', borderRadius: 100, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-jakarta)", flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        Continue to checkout
                    </button>
                ) : (
                    <a
                        href="#rooms-section"
                        style={{ padding: '12px 22px', borderRadius: 100, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
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
