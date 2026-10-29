'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { POI_FILTERS, type PoiCategory } from '@/shared/config/map-discovery';
import { categoryToBg, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { DistanceUnitToggle } from '@/shared/components/common/DistanceUnitToggle';
import { RADIUS_OPTIONS, formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import { cn } from '@/shared/lib/cn';
import type { LatLng, NearbyPalette } from './types';

/**
 * Everything the nearby strip works from. It is drawn as two pieces — `PlaceFilters` under the
 * map and `PlaceCards` over the map's bottom edge — and each takes the slice it needs.
 */
export interface PlaceStripProps {
    gems: NearbyGem[];
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    category: PoiCategory;
    onCategoryChange: (category: PoiCategory) => void;
    /** Metres. */
    radius: number;
    onRadiusChange: (meters: number) => void;
    unit: DistanceUnit;
    onUnitChange: (unit: DistanceUnit) => void;
    hotel: LatLng;
    activeId: string | null;
    onSelect: (gem: NearbyGem) => void;
    onDetails: (gem: NearbyGem) => void;
    palette: NearbyPalette;
}

type PlaceFiltersProps = Pick<
    PlaceStripProps,
    'gems' | 'error' | 'onRetry' | 'category' | 'onCategoryChange' | 'radius' | 'onRadiusChange' | 'unit' | 'onUnitChange' | 'palette'
>;

type PlaceCardsProps = Pick<
    PlaceStripProps,
    'gems' | 'loading' | 'error' | 'onRetry' | 'unit' | 'hotel' | 'activeId' | 'onSelect' | 'onDetails' | 'palette'
> & { className?: string };

const SKELETONS = 8;

function pillStyle(palette: NearbyPalette): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
        border: `1px solid ${palette.cardBorder}`, background: palette.cardBg, color: palette.title,
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
    };
}

/** The category dropdown, the radius steps and the unit toggle — and a note when the lookup came back incomplete. */
export function PlaceFilters({
    gems, error, onRetry, category, onCategoryChange, radius, onRadiusChange, unit, onUnitChange, palette,
}: PlaceFiltersProps) {
    const t = useTranslations('property.nearby');
    const locale = useLocale();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Close on a press outside the dropdown (no backdrop, so the press still reaches what it hit).
    useEffect(() => {
        if (!menuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [menuOpen]);

    const closeMenu = (refocus: boolean) => {
        setMenuOpen(false);
        if (refocus) triggerRef.current?.focus();
    };

    const radiusSteps = RADIUS_OPTIONS[unit];
    const currentStep = radiusSteps.indexOf(radius);
    const tabStop = currentStep === -1 ? 0 : currentStep;
    /** Arrow keys step through the radii and stop at the ends (no wrap). */
    const onRadiusKey = (e: React.KeyboardEvent, index: number) => {
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const next = index + delta;
        if (next < 0 || next >= radiusSteps.length) return;
        onRadiusChange(radiusSteps[next]);
        radioRefs.current[next]?.focus();
    };

    const selected = POI_FILTERS.find((f) => f.id === category) ?? POI_FILTERS[0];
    const SelectedIcon = selected.icon;
    const pill = pillStyle(palette);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div
                    ref={menuRef}
                    style={{ position: 'relative' }}
                    onKeyDown={(e) => { if (e.key === 'Escape' && menuOpen) { e.stopPropagation(); closeMenu(true); } }}
                    onBlur={(e) => { if (menuOpen && !menuRef.current?.contains(e.relatedTarget as Node | null)) setMenuOpen(false); }}
                >
                    <button
                        ref={triggerRef}
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        aria-label={`${t('categoryLabel')}: ${t(`categories.${selected.id}`)}`}
                        onClick={() => setMenuOpen((open) => !open)}
                        style={pill}
                    >
                        <SelectedIcon size={14} aria-hidden />
                        <span>{t(`categories.${selected.id}`)}</span>
                        <ChevronDown size={14} aria-hidden style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
                    </button>
                    {menuOpen && (
                        <>
                            <div
                                role="listbox"
                                aria-label={t('categoryLabel')}
                                style={{
                                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 200,
                                    padding: 6, borderRadius: 14, background: palette.bg,
                                    border: `1px solid ${palette.cardBorder}`, boxShadow: '0 12px 32px rgba(0,0,0,.25)',
                                }}
                            >
                                {POI_FILTERS.map((f) => {
                                    const Icon = f.icon;
                                    const active = f.id === category;
                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => { onCategoryChange(f.id); closeMenu(true); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
                                                borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                                                fontSize: 14, fontWeight: 600,
                                                background: active ? BRAND.primaryStrong : 'transparent',
                                                color: active ? '#fff' : palette.text,
                                            }}
                                        >
                                            <Icon size={14} aria-hidden />
                                            {t(`categories.${f.id}`)}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div role="radiogroup" aria-label={t('radiusLabel')} style={{ ...pill, gap: 2, padding: 2, cursor: 'default' }}>
                    {radiusSteps.map((meters, i) => {
                        const active = meters === radius;
                        return (
                            <button
                                key={meters}
                                type="button"
                                role="radio"
                                ref={(el) => { radioRefs.current[i] = el; }}
                                aria-checked={active}
                                tabIndex={i === tabStop ? 0 : -1}
                                onKeyDown={(e) => onRadiusKey(e, i)}
                                onClick={() => onRadiusChange(meters)}
                                style={{
                                    padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 700,
                                    background: active ? BRAND.primaryStrong : 'transparent',
                                    color: active ? '#fff' : palette.muted,
                                }}
                            >
                                {formatDistance(meters, unit, locale)}
                            </button>
                        );
                    })}
                </div>

                <DistanceUnitToggle
                    value={unit}
                    onChange={onUnitChange}
                    label={t('unitLabel')}
                    colors={{ muted: palette.muted, border: palette.cardBorder, activeBg: BRAND.primaryStrong, activeFg: '#fff' }}
                />
            </div>

            {error && gems.length > 0 && (
                <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, color: palette.muted, fontSize: 13 }}>
                    <span>{t('loadFailed')}</span>
                    <button type="button" onClick={onRetry} style={pill}>{t('retry')}</button>
                </div>
            )}
        </div>
    );
}

/**
 * The places themselves, as a row of photo cards that scrolls sideways.
 *
 * Drawn over the map's bottom edge, so whatever stands in for the cards — the loading
 * placeholders, the failure with its retry, the empty note — sits on a plate of its own: bare
 * text over a street map is not legible.
 *
 * The row itself takes no pointer events outside its cards, so the map still pans when dragged
 * from the gaps between them.
 */
export function PlaceCards({
    gems, loading, error, onRetry, unit, hotel, activeId, onSelect, onDetails, palette, className,
}: PlaceCardsProps) {
    const t = useTranslations('property.nearby');
    const tAll = useTranslations();
    const locale = useLocale();
    const scrollRef = useRef<HTMLDivElement>(null);
    const scroll = (direction: -1 | 1) => scrollRef.current?.scrollBy({ left: direction * 300, behavior: 'smooth' });
    const notice: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14,
        background: palette.bg, color: palette.muted, fontSize: 15,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)', pointerEvents: 'auto',
    };

    let body: React.ReactNode;
    if (gems.length > 0) {
        body = gems.map((g) => (
            <PlaceCard
                key={g.id}
                gem={g}
                distance={formatDistance(haversineMeters(hotel, g.coordinates), unit, locale)}
                active={g.id === activeId}
                onSelect={onSelect}
                onDetails={onDetails}
                detailsLabel={t('details')}
                ratingLabel={g.rating !== null && g.rating > 0 ? t('ratingOutOf5', { rating: g.rating.toFixed(1) }) : undefined}
            />
        ));
    } else if (loading) {
        body = Array.from({ length: SKELETONS }, (_, i) => (
            <div key={i} data-testid="place-skeleton" className="shrink-0 animate-pulse" style={{ width: 192, height: 128, background: palette.iconBg }} />
        ));
    } else if (error) {
        body = (
            <div role="alert" style={notice}>
                <span>{t('loadFailed')}</span>
                <button type="button" onClick={onRetry} style={pillStyle(palette)}>{t('retry')}</button>
            </div>
        );
    } else {
        body = <p style={notice}>{tAll('hotels.nearby.none')}</p>;
    }

    return (
        <div className={cn('pointer-events-none relative', className)}>
            {gems.length > 3 && (
                <button type="button" aria-label={t('scrollLeft')} onClick={() => scroll(-1)} className="pointer-events-auto hidden lg:flex" style={arrowStyle('left', palette)}>
                    <ChevronLeft size={16} aria-hidden />
                </button>
            )}
            <div ref={scrollRef} className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollBehavior: 'smooth', padding: '8px 12px' }}>
                {body}
            </div>
            {gems.length > 3 && (
                <button type="button" aria-label={t('scrollRight')} onClick={() => scroll(1)} className="pointer-events-auto hidden lg:flex" style={arrowStyle('right', palette)}>
                    <ChevronRight size={16} aria-hidden />
                </button>
            )}
        </div>
    );
}

/** Inside the row's ends rather than hanging past them — the map clips anything past its edge. */
function arrowStyle(side: 'left' | 'right', palette: NearbyPalette): React.CSSProperties {
    return {
        ...(side === 'left' ? { left: 6 } : { right: 6 }),
        position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
        width: 30, height: 30, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
        background: palette.bg, color: palette.title, border: `1px solid ${palette.cardBorder}`,
        boxShadow: '0 4px 12px rgba(0,0,0,.2)', cursor: 'pointer',
    };
}

interface PlaceCardProps {
    gem: NearbyGem;
    distance: string;
    active: boolean;
    onSelect: (gem: NearbyGem) => void;
    onDetails: (gem: NearbyGem) => void;
    detailsLabel: string;
    /** "4.6 out of 5 stars" — absent when the place has no rating. */
    ratingLabel?: string;
}

/**
 * A photo card. The whole card selects the place; "Details" sits above it as a separate button, so
 * the two are siblings rather than a button inside a button.
 *
 * Square, like the room cards and the map it sits on. The rating is the place popup's own mark —
 * an amber star and the score — set in line with the distance, not a white pill of its own over the
 * photo.
 */
function PlaceCard({ gem, distance, active, onSelect, onDetails, detailsLabel, ratingLabel }: PlaceCardProps) {
    const Icon = gem.icon;
    const rating = gem.rating !== null && gem.rating > 0 ? gem.rating.toFixed(1) : null;
    const name = gem.translatedName ?? gem.name;

    return (
        <div
            className={`pointer-events-auto relative shrink-0 overflow-hidden bg-linear-to-br shadow-[0_8px_20px_-6px_rgba(0,0,0,0.45)] has-[button[data-select]:focus-visible]:outline-2 has-[button[data-select]:focus-visible]:outline-offset-2 ${categoryToBg(gem.category)}`}
            style={{ width: 192, height: 128, ...(active ? { outline: `3px solid ${BRAND.primary}`, outlineOffset: 2 } : {}), outlineColor: BRAND.primary }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the api-v2 proxy with an SVG fallback; next/image would need remotePatterns for that host */}
            <img
                src={gem.imageUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Icon size={34} className="text-white/20" aria-hidden />
            </div>

            <button
                type="button"
                data-select
                aria-label={name}
                aria-pressed={active}
                onClick={() => onSelect(gem)}
                className="absolute inset-0 cursor-pointer"
                style={{ background: 'transparent', border: 'none' }}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
                <div className="truncate text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {gem.displayCategory ?? gem.category.replace(/_/g, ' ')}
                </div>
                <div className="line-clamp-2 text-[13px] font-extrabold leading-tight text-white" aria-hidden>
                    {name}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/75">
                    {rating && (
                        <>
                            <span role="img" aria-label={ratingLabel} className="inline-flex items-center gap-0.5 font-bold text-white">
                                <Star size={11} className="fill-amber-400 text-amber-400" aria-hidden />
                                <span aria-hidden>{rating}</span>
                            </span>
                            <span aria-hidden>·</span>
                        </>
                    )}
                    <span>{distance}</span>
                </div>
            </div>

            <button
                type="button"
                aria-label={`${detailsLabel}: ${name}`}
                onClick={() => onDetails(gem)}
                className="absolute top-2 right-2 z-10 rounded-lg bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur hover:bg-black/55"
            >
                {detailsLabel}
            </button>
        </div>
    );
}
