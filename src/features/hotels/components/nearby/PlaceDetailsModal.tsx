'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, MapPin, Phone, Star, X } from 'lucide-react';
import { categoryToBg, type NearbyGem, type PoiReview } from '@/features/hotels/hooks/useNearbyGems';
import { formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/components/ui/badge';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { googleMapsUrl, safeHttpUrl } from './links';
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
 * The modal's surfaces and ink, per tone — the room details modal's own (`roomPalette` in
 * room-selection), so the two dialogs on the property page read as one design: the same slate-900
 * or white sheet, the same body and label greys, the same hairline and close button.
 */
function modalChrome(dark: boolean) {
    return {
        sheet:  dark ? 'bg-slate-900' : 'bg-white',
        title:  dark ? 'text-white' : 'text-slate-900',
        text:   dark ? 'text-slate-300' : 'text-slate-700',
        label:  'text-slate-500',
        empty:  dark ? 'text-slate-500' : 'text-slate-400',
        rule:   dark ? 'divide-white/[0.08]' : 'divide-slate-100',
        close:  dark
            ? 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14]'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        /** The room cards' quiet outline — the rest state of their filter chips — squared off. */
        action: dark
            ? 'border border-white/25 text-white/80 hover:bg-white/[0.06]'
            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    };
}

/**
 * v1's place popup — photo, rating, call / website / map, hours, Google's reviews.
 *
 * Drawn as the room details modal is: square, on the same deep scrim, a bottom sheet on a phone and
 * a centred dialog from `md`, with small uppercase labels over each section and the open / closed
 * state as the same badge the room modal uses for its cancellation terms.
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

    useBodyScrollLock(open);

    // Focus the close button on open and hand focus back to whatever had it on close (if it still exists).
    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeRef.current?.focus();
        return () => {
            if (opener?.isConnected) opener.focus();
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
    const website = safeHttpUrl(gem.website);
    const c = modalChrome(isDarkBackground(palette.bg));
    const hasRatingInfo = (gem.rating !== null && gem.rating > 0) || !!gem.userRatingsTotal;

    const eyebrow = cn('text-[10px] font-bold tracking-[0.12em] uppercase', c.label);
    const action = cn(
        'flex flex-1 items-center justify-center gap-2 rounded-[2px] px-3 py-2.5 text-[13px] font-bold no-underline transition-colors',
        c.action,
    );

    return createPortal(
        // The room modal's scrim, so opening either dialog dims the page the same way.
        <div
            role="presentation"
            onClick={onClose}
            className="fixed inset-0 z-[10050] flex items-end justify-center bg-slate-950/75 md:items-center md:p-4"
        >
            <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                    // Square, like the room details modal and the cards on the page.
                    'relative flex max-h-[92vh] w-full flex-col overflow-hidden shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15)]',
                    'md:max-h-[88vh] md:max-w-[520px]',
                    c.sheet,
                )}
            >
                {/* Outside the scrolling body, so it stays at the corner as the reviews scroll. */}
                <button
                    ref={closeRef}
                    type="button"
                    aria-label={t('close')}
                    onClick={onClose}
                    className={cn('absolute top-5 right-5 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors', c.close)}
                >
                    <X size={16} aria-hidden />
                </button>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {/* The photo edge to edge, the name and rating riding its bottom on the same
                        scrim the room modal lays under its counter and thumbnails. */}
                    <div className={`relative h-52 shrink-0 bg-linear-to-br ${categoryToBg(gem.category)}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the api-v2 proxy with an SVG fallback */}
                        <img src={gem.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><Icon size={48} className="text-white/20" aria-hidden /></div>
                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent px-6 pt-16 pb-4 text-white">
                            <h2 id={titleId} className="font-display text-[22px] leading-[1.2] font-bold tracking-[-0.02em]">{name}</h2>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
                                {gem.rating !== null && gem.rating > 0 && (
                                    <span role="img" aria-label={t('ratingOutOf5', { rating: gem.rating.toFixed(1) })} className="inline-flex items-center gap-1 font-bold">
                                        <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden /> <span aria-hidden>{gem.rating.toFixed(1)}</span>
                                    </span>
                                )}
                                {gem.userRatingsTotal ? <span className="text-white/80">{t('reviewsCount', { count: gem.userRatingsTotal })}</span> : null}
                                {hasRatingInfo && <span aria-hidden className="text-white/80">·</span>}
                                <span className="text-white/80">{t('away', { distance })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-[18px] px-6 py-5">
                        <div className="flex gap-2">
                            {gem.phone && <a href={`tel:${gem.phone}`} className={action}><Phone size={15} strokeWidth={1.75} aria-hidden />{t('call')}</a>}
                            {website && <a href={website} target="_blank" rel="noopener noreferrer" className={action}><Globe size={15} strokeWidth={1.75} aria-hidden />{t('website')}</a>}
                            <a href={googleMapsUrl(gem)} target="_blank" rel="noopener noreferrer" className={action}><MapPin size={15} strokeWidth={1.75} aria-hidden />{t('googleMaps')}</a>
                        </div>

                        {gem.vicinity && (
                            <p className={cn('flex items-start gap-2 text-[13px] leading-[1.5]', c.text)}>
                                <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />{gem.vicinity}
                            </p>
                        )}

                        {hours.length > 0 && (
                            <section className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <p className={eyebrow}>{tPoi('openingHours')}</p>
                                    {gem.openingHours?.open_now !== undefined && (
                                        <Badge variant={gem.openingHours.open_now ? 'success' : 'destructive'}>
                                            {gem.openingHours.open_now ? tPoi('openNow') : tPoi('closed')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {hours.map((h) => (
                                        <p key={h.text} className={cn('text-[13px]', h.includesToday ? cn('font-bold', c.title) : c.text)}>{h.text}</p>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="flex flex-col gap-2">
                            <p className={eyebrow}>{tPoi('googleReviews')}</p>
                            {reviews.length === 0
                                ? <p className={cn('text-[13px]', c.empty)}>{tPoi('noReviews')}</p>
                                : (
                                    <div className={cn('flex flex-col divide-y', c.rule)}>
                                        {reviews.map((r, i) => <ReviewItem key={`${r.author_name}-${i}`} review={r} chrome={c} />)}
                                    </div>
                                )}
                        </section>
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}

/** One Google review: no plate of its own, set off from the next by the list's hairline. */
function ReviewItem({ review, chrome: c }: { review: PoiReview; chrome: ReturnType<typeof modalChrome> }) {
    const t = useTranslations('property.nearby');
    const [photoFailed, setPhotoFailed] = useState(false);
    return (
        <div className="py-3 first:pt-1 last:pb-0">
            <div className="mb-1.5 flex items-center gap-2.5">
                {review.profile_photo_url && !photoFailed
                    ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Google avatar URLs are remote and not proxied
                        <img src={review.profile_photo_url} alt="" width={28} height={28} referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} className="size-7 rounded-full" />
                    )
                    : (
                        <div className="flex size-7 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: BRAND.primaryStrong }}>
                            {review.author_name.charAt(0)}
                        </div>
                    )}
                <div>
                    <div className={cn('text-[13px] font-bold', c.title)}>{review.author_name}</div>
                    <div className={cn('flex items-center gap-1.5 text-[12px]', c.label)}>
                        <span role="img" aria-label={t('ratingOutOf5', { rating: review.rating })} className="text-amber-400">{'★'.repeat(Math.round(review.rating))}</span>
                        {review.relative_time_description && <span>{review.relative_time_description}</span>}
                    </div>
                </div>
            </div>
            <p className={cn('text-[13px] leading-[1.55]', c.text)}>{review.text}</p>
        </div>
    );
}

/**
 * Whether the palette's ground is dark, judged by its luminance — the page passes one palette for
 * both themes (ADR-0004), so the modal's tone follows from it. Unparseable colours count as light.
 */
function isDarkBackground(bg: string): boolean {
    const m = /^#([0-9a-f]{6})$/i.exec(bg.trim());
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return lum < 0.5;
}
