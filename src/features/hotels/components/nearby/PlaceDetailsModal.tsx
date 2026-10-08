'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, Globe, MapPin, Phone, Star, X } from 'lucide-react';
import { categoryToBg, type NearbyGem, type PoiReview } from '@/features/hotels/hooks/useNearbyGems';
import { formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import { googleMapsUrl } from './links';
import { groupOpeningHours } from './opening-hours';
import type { LatLng, NearbyPalette } from './types';

interface PlaceDetailsModalProps {
    gem: NearbyGem | null;
    hotel: LatLng;
    unit: DistanceUnit;
    palette: NearbyPalette;
    onClose: () => void;
}

/**
 * v1's place popup — photo, rating, call / website / map, hours, Google's reviews.
 *
 * v1 also had a form to post a review and photos. It saved to the poster's own browser and showed
 * the result as "Cheapest Go Reviews" though nobody else could ever see it, so it is not ported.
 */
export function PlaceDetailsModal({ gem, hotel, unit, palette, onClose }: PlaceDetailsModalProps) {
    const t = useTranslations('property.nearby');
    const tPoi = useTranslations('property.poiDetails');
    const locale = useLocale();
    const titleId = useId();

    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const open = gem !== null;

    // Focus the close button on open, hand focus back to whatever had it on close, lock page scroll.
    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
            opener?.focus();
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            const items = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            if (!items?.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            const outside = !dialogRef.current?.contains(active);
            if (e.shiftKey && (active === first || outside)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (active === last || outside)) { e.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!gem) return null;

    const name = gem.translatedName ?? gem.name;
    const distance = formatDistance(haversineMeters(hotel, gem.coordinates), unit, locale);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const hours = groupOpeningHours(gem.openingHours?.weekday_text, today);
    const reviews = gem.reviews ?? [];
    const Icon = gem.icon;

    const action: React.CSSProperties = {
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px',
        borderRadius: 12, background: palette.iconBg, color: palette.title, fontSize: 14, fontWeight: 700,
        textDecoration: 'none', border: `1px solid ${palette.cardBorder}`,
    };

    return createPortal(
        <div
            role="presentation"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', borderRadius: 20, background: palette.bg, color: palette.text, border: `1px solid ${palette.cardBorder}`, boxShadow: '0 24px 60px rgba(0,0,0,.4)' }}
            >
                <div className={`relative bg-linear-to-br ${categoryToBg(gem.category)}`} style={{ height: 200 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the api-v2 proxy with an SVG fallback */}
                    <img src={gem.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><Icon size={48} className="text-white/20" aria-hidden /></div>
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    <button
                        ref={closeRef}
                        type="button"
                        aria-label={t('close')}
                        onClick={onClose}
                        style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <X size={18} aria-hidden />
                    </button>
                    <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, color: '#fff' }}>
                        <h2 id={titleId} style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>{name}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 14, flexWrap: 'wrap' }}>
                            {gem.rating !== null && gem.rating > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                    <Star size={14} fill="#f59e0b" color="#f59e0b" aria-hidden /> {gem.rating.toFixed(1)}
                                </span>
                            )}
                            {gem.userRatingsTotal ? <span style={{ opacity: 0.8 }}>{t('reviewsCount', { count: gem.userRatingsTotal })}</span> : null}
                            <span style={{ opacity: 0.8 }}>· {t('away', { distance })}</span>
                        </div>
                    </div>
                </div>

                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {gem.phone && <a href={`tel:${gem.phone}`} style={action}><Phone size={16} aria-hidden />{t('call')}</a>}
                        {gem.website && <a href={gem.website} target="_blank" rel="noopener noreferrer" style={action}><Globe size={16} aria-hidden />{t('website')}</a>}
                        <a href={googleMapsUrl(gem)} target="_blank" rel="noopener noreferrer" style={action}><MapPin size={16} aria-hidden />{t('googleMaps')}</a>
                    </div>

                    {gem.vicinity && (
                        <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: 0, color: palette.soft, fontSize: 15 }}>
                            <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />{gem.vicinity}
                        </p>
                    )}

                    {hours.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Clock size={16} color={palette.muted} aria-hidden />
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: palette.title }}>{tPoi('openingHours')}</h3>
                                {gem.openingHours?.open_now !== undefined && (
                                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: gem.openingHours.open_now ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: gem.openingHours.open_now ? '#059669' : '#dc2626' }}>
                                        {gem.openingHours.open_now ? tPoi('openNow') : tPoi('closed')}
                                    </span>
                                )}
                            </div>
                            {hours.map((h) => (
                                <p key={h.text} style={{ margin: '2px 0', fontSize: 14, color: h.includesToday ? palette.title : palette.muted, fontWeight: h.includesToday ? 700 : 400 }}>{h.text}</p>
                            ))}
                        </section>
                    )}

                    <section>
                        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: palette.title }}>{tPoi('googleReviews')}</h3>
                        {reviews.length === 0
                            ? <p style={{ margin: 0, fontSize: 14, color: palette.muted }}>{tPoi('noReviews')}</p>
                            : reviews.map((r, i) => <ReviewItem key={`${r.author_name}-${i}`} review={r} palette={palette} />)}
                    </section>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ReviewItem({ review, palette }: { review: PoiReview; palette: NearbyPalette }) {
    return (
        <div style={{ padding: 14, borderRadius: 14, background: palette.cardBg, border: `1px solid ${palette.cardBorder}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {review.profile_photo_url
                    ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Google avatar URLs are remote and not proxied
                        <img src={review.profile_photo_url} alt="" width={28} height={28} referrerPolicy="no-referrer" style={{ borderRadius: '50%' }} />
                    )
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: BRAND.primaryStrong, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{review.author_name.charAt(0)}</div>}
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: palette.title }}>{review.author_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: palette.muted }}>
                        <span aria-label={`${review.rating} / 5`}>{'★'.repeat(Math.round(review.rating))}</span>
                        {review.relative_time_description && <span>{review.relative_time_description}</span>}
                    </div>
                </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: palette.text }}>{review.text}</p>
        </div>
    );
}
