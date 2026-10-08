'use client';

import React, { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { POI_FILTERS, type PoiCategory } from '@/shared/config/map-discovery';
import { categoryToBg, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { DistanceUnitToggle } from '@/shared/components/common/DistanceUnitToggle';
import { RADIUS_OPTIONS, formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import type { LatLng, NearbyPalette } from './types';

interface PlaceStripProps {
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

const SKELETONS = 8;

export function PlaceStrip({
    gems, loading, error, onRetry, category, onCategoryChange, radius, onRadiusChange,
    unit, onUnitChange, hotel, activeId, onSelect, onDetails, palette,
}: PlaceStripProps) {
    const t = useTranslations('property.nearby');
    const tAll = useTranslations();
    const locale = useLocale();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    const selected = POI_FILTERS.find((f) => f.id === category) ?? POI_FILTERS[0];
    const SelectedIcon = selected.icon;
    const scroll = (direction: -1 | 1) => scrollRef.current?.scrollBy({ left: direction * 300, behavior: 'smooth' });

    const pill: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
        border: `1px solid ${palette.cardBorder}`, background: palette.cardBg, color: palette.title,
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
            />
        ));
    } else if (loading) {
        body = Array.from({ length: SKELETONS }, (_, i) => (
            <div key={i} data-testid="place-skeleton" className="shrink-0 animate-pulse rounded-2xl" style={{ width: 192, height: 128, background: palette.iconBg }} />
        ));
    } else if (error) {
        body = (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, color: palette.muted, fontSize: 15, padding: '16px 0' }}>
                <span>{t('loadFailed')}</span>
                <button type="button" onClick={onRetry} style={pill}>{t('retry')}</button>
            </div>
        );
    } else {
        body = <p style={{ color: palette.muted, fontSize: 15, padding: '16px 0' }}>{tAll('hotels.nearby.none')}</p>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        aria-label={t('categoryLabel')}
                        onClick={() => setMenuOpen((open) => !open)}
                        style={pill}
                    >
                        <SelectedIcon size={14} aria-hidden />
                        <span>{t(`categories.${selected.id}`)}</span>
                        <ChevronDown size={14} aria-hidden style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
                    </button>
                    {menuOpen && (
                        <>
                            <div aria-hidden onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
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
                                            onClick={() => { onCategoryChange(f.id); setMenuOpen(false); }}
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
                    {RADIUS_OPTIONS[unit].map((meters) => {
                        const active = meters === radius;
                        return (
                            <button
                                key={meters}
                                type="button"
                                role="radio"
                                aria-checked={active}
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

            <div style={{ position: 'relative' }}>
                {gems.length > 3 && (
                    <button type="button" aria-label={t('scrollLeft')} onClick={() => scroll(-1)} className="hidden lg:flex" style={arrowStyle('left', palette)}>
                        <ChevronLeft size={16} aria-hidden />
                    </button>
                )}
                <div ref={scrollRef} className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollBehavior: 'smooth', padding: '4px 2px' }}>
                    {body}
                </div>
                {gems.length > 3 && (
                    <button type="button" aria-label={t('scrollRight')} onClick={() => scroll(1)} className="hidden lg:flex" style={arrowStyle('right', palette)}>
                        <ChevronRight size={16} aria-hidden />
                    </button>
                )}
            </div>
        </div>
    );
}

function arrowStyle(side: 'left' | 'right', palette: NearbyPalette): React.CSSProperties {
    return {
        ...(side === 'left' ? { left: -12 } : { right: -12 }),
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
}

/**
 * A photo card. The whole card selects the place; "Details" sits above it as a separate button, so
 * the two are siblings rather than a button inside a button.
 */
function PlaceCard({ gem, distance, active, onSelect, onDetails, detailsLabel }: PlaceCardProps) {
    const Icon = gem.icon;
    const rating = gem.rating !== null && gem.rating > 0 ? gem.rating.toFixed(1) : null;
    const name = gem.translatedName ?? gem.name;

    return (
        <div
            className={`relative shrink-0 overflow-hidden rounded-2xl bg-linear-to-br ${categoryToBg(gem.category)}`}
            style={{ width: 192, height: 128, outline: active ? `3px solid ${BRAND.primary}` : 'none', outlineOffset: 2 }}
        >
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
                aria-label={gem.name}
                aria-pressed={active}
                onClick={() => onSelect(gem)}
                className="absolute inset-0 cursor-pointer"
                style={{ background: 'transparent', border: 'none' }}
            />

            {rating && (
                <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[11px] font-extrabold text-slate-800">
                    <Star size={10} className="fill-amber-400 text-amber-400" aria-hidden />
                    {rating}
                </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
                <div className="truncate text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {gem.displayCategory ?? gem.category.replace(/_/g, ' ')}
                </div>
                <div className="line-clamp-2 text-[13px] font-extrabold leading-tight text-white" aria-hidden={name === gem.name}>
                    {name}
                </div>
                <div className="text-[11px] font-semibold text-white/75">{distance}</div>
            </div>

            <button
                type="button"
                onClick={() => onDetails(gem)}
                className="absolute top-2 right-2 z-10 rounded-lg bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur hover:bg-black/55"
            >
                {detailsLabel}
            </button>
        </div>
    );
}
