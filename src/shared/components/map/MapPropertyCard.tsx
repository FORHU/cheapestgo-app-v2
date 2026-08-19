'use client';

import React from 'react';
import Image from 'next/image';
import { MapPin, Building2 } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { useUserCurrency } from '@/shared/stores/search.store';
import { cn } from '@/shared/lib/cn';
import type { MappableProperty } from './types';

export interface MapPropertyCardProps {
    property: MappableProperty;
    isSelected: boolean;
    isHovered: boolean;
    onSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onViewDetails?: (id: string) => void;
    index?: number;
    immersive?: boolean;
}

const ACCENT  = '#FF6B4B';
const IM_TEXT = '#F5EFE4';
const IM_DIM  = 'rgba(245,239,228,0.45)';

function getRatingLabel(rating: number): string {
    if (rating === 0) return '';
    if (rating >= 9) return 'Exceptional';
    if (rating >= 8) return 'Excellent';
    if (rating >= 7) return 'Very Good';
    if (rating >= 6) return 'Good';
    if (rating >= 5) return 'Fair';
    return 'Poor';
}

function getRatingBadgeColor(rating: number): string {
    if (rating >= 9) return '#2FB67F';
    if (rating >= 8) return '#22c55e';
    if (rating >= 7) return '#4FA8E0';
    if (rating >= 6) return '#14b8a6';
    if (rating >= 5) return '#f97316';
    return '#ef4444';
}

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

function StarRating({ rating, size = 11, accent = '#3b82f6', emptyColor = '' }: { rating: number; size?: number; accent?: string; emptyColor?: string }) {
    const pct = Math.min(100, Math.max(0, (rating / 10) * 100));
    return (
        <div className="relative inline-flex gap-px">
            {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={cn('shrink-0', !emptyColor && 'text-slate-200 dark:text-slate-700')} style={emptyColor ? { color: emptyColor } : undefined}>
                    <path d={STAR_PATH} fill="currentColor" />
                </svg>
            ))}
            <div className="absolute inset-0 overflow-hidden flex gap-px" style={{ width: `${pct}%` }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="shrink-0" style={{ color: accent }}>
                        <path d={STAR_PATH} fill="currentColor" />
                    </svg>
                ))}
            </div>
        </div>
    );
}

export const MapPropertyCard = React.memo(function MapPropertyCard({
    property,
    isSelected,
    isHovered,
    onSelect,
    onHover,
    onViewDetails,
    index,
    immersive = false,
}: MapPropertyCardProps) {
    const targetCurrency = useUserCurrency();
    const sourceCurrency = property.currency || 'USD';
    const displayPrice = React.useMemo(
        () => convertCurrency(property.price, sourceCurrency, targetCurrency),
        [property.price, sourceCurrency, targetCurrency]
    );
    const displayOriginalPrice = React.useMemo(
        () => property.originalPrice
            ? convertCurrency(property.originalPrice, sourceCurrency, targetCurrency)
            : undefined,
        [property.originalPrice, sourceCurrency, targetCurrency]
    );
    const rating = property.rating ?? 0;
    const starRating = property.starRating ?? 0;
    const ratingLabel = React.useMemo(() => getRatingLabel(rating), [rating]);
    const ratingColor = React.useMemo(() => getRatingBadgeColor(rating), [rating]);

    const wrapperStyle: React.CSSProperties = immersive ? {
        background: isSelected ? 'rgba(255,107,75,0.07)' : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent',
        transition: 'background .15s, border-color .15s',
    } : {};

    const badgeBg = immersive ? ACCENT : '#3b82f6';
    const priceColor = immersive ? ACCENT : undefined;
    const textColor = immersive ? IM_TEXT : undefined;
    const dimColor = immersive ? IM_DIM : undefined;
    const skeletonBg = immersive ? 'rgba(255,255,255,0.08)' : undefined;
    const starAccent = immersive ? ACCENT : '#3b82f6';
    const starEmpty = immersive ? 'rgba(255,255,255,0.15)' : '';

    return (
        <div
            role="button"
            tabIndex={0}
            data-property-id={property.id}
            onClick={() => onSelect(property.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(property.id); } }}
            onMouseEnter={() => onHover(property.id)}
            onMouseLeave={() => onHover(null)}
            style={wrapperStyle}
            className={cn(
                'w-full text-left transition-all duration-200 cursor-pointer overflow-hidden rounded-xl',
                'p-2.5 md:px-4 md:py-2.5 lg:px-6 lg:py-3',
                !immersive && 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                !immersive && isSelected && 'bg-blue-50 dark:bg-blue-950/40 md:border-l-[3px] md:border-l-blue-500',
                !immersive && isHovered && !isSelected && 'bg-slate-50 dark:bg-slate-800/40'
            )}
        >
            {/* ── MOBILE ── */}
            <div className="flex flex-row gap-2 md:hidden">
                <div
                    className="relative shrink-0 rounded-xl overflow-hidden"
                    style={{ width: 76, height: 76, background: immersive ? 'rgba(255,255,255,0.06)' : undefined }}
                >
                    {!immersive && <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800" />}
                    {property.image ? (
                        <Image src={property.image} alt={property.name} fill className="object-cover" sizes="100px" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: immersive ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#dbeafe,#f1f5f9)' }}>
                            <Building2 className="w-4 h-4" style={{ color: immersive ? IM_DIM : '#94a3b8' }} />
                        </div>
                    )}
                    {index !== undefined && (
                        <span className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center shadow z-10" style={{ background: badgeBg }}>
                            <span className={cn('text-white font-bold leading-none', index > 99 ? 'text-[6px]' : index > 9 ? 'text-[8px]' : 'text-[9px]')}>{index}</span>
                        </span>
                    )}
                    {property.refundableTag === 'RFN' && (
                        <span className="absolute bottom-1 left-1 text-[7px] font-semibold bg-emerald-500 text-white px-1 py-px rounded-full shadow z-10">
                            Free cancel
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="min-w-0">
                        <h3 className={cn('text-[11.5px] font-bold leading-tight line-clamp-2', !immersive && 'text-slate-900 dark:text-white')}
                            style={{ color: textColor }}>
                            {property.name}
                        </h3>
                        {property.location && (
                            <p className={cn('text-[9.5px] leading-tight mt-0.5 truncate flex items-center gap-0.5', !immersive && 'text-slate-400 dark:text-slate-500')}
                                style={{ color: dimColor }}>
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                {property.location}
                            </p>
                        )}
                    </div>

                    {rating > 0 ? (
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-md" style={{ background: ratingColor }}>
                                {rating.toFixed(1)} {ratingLabel}
                            </span>
                            <StarRating rating={rating} size={9} accent={starAccent} emptyColor={starEmpty} />
                        </div>
                    ) : starRating > 0 ? (
                        <div className="mt-1">
                            <StarRating rating={starRating * 2} size={9} accent={starAccent} emptyColor={starEmpty} />
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between mt-1 gap-1">
                        <div className="flex items-baseline gap-0.5 min-w-0">
                            {property.priceLoading ? (
                                <div className={cn('h-4 w-16 rounded animate-pulse', !immersive && 'bg-slate-200 dark:bg-slate-700')} style={{ background: skeletonBg }} />
                            ) : (
                                <>
                                    <span className={cn('text-[13px] font-bold truncate', !immersive && 'text-blue-600 dark:text-blue-400')} style={{ color: priceColor }}>
                                        {formatCurrency(displayPrice, targetCurrency)}
                                    </span>
                                    <span className={cn('text-[8px] shrink-0', !immersive && 'text-slate-400')} style={{ color: dimColor }}>/night</span>
                                </>
                            )}
                        </div>
                        {onViewDetails && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onViewDetails(property.id); }}
                                className={cn('shrink-0 active:scale-95 text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap', !immersive && 'bg-blue-600 hover:bg-blue-700')}
                                style={immersive ? { background: ACCENT } : undefined}>
                                View Deal
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── DESKTOP ── */}
            <div className="hidden md:flex gap-3">
                <div
                    className={cn('relative w-20 h-16 lg:w-24 lg:h-20 shrink-0 rounded-xl overflow-hidden', !immersive && 'bg-slate-100 dark:bg-slate-800')}
                    style={immersive ? { background: 'rgba(255,255,255,0.06)' } : undefined}
                >
                    {property.image ? (
                        <Image src={property.image} alt={property.name} fill className="object-cover" sizes="(max-width: 1024px) 80px, 96px" />
                    ) : (
                        <div
                            className={cn('w-full h-full flex items-center justify-center', !immersive && 'bg-linear-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900')}
                            style={immersive ? { background: 'rgba(255,255,255,0.04)' } : undefined}
                        >
                            <Building2 className={cn('w-6 h-6', !immersive && 'text-slate-300 dark:text-slate-600')} style={{ color: immersive ? IM_DIM : undefined }} />
                        </div>
                    )}
                    {property.refundableTag === 'RFN' && (
                        <span className="absolute top-1 left-1 text-[9px] font-semibold bg-emerald-500 text-white px-1.5 py-0.5 rounded z-10">
                            Free cancel
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                        <div className="flex items-start gap-1.5">
                            {index !== undefined && (
                                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: badgeBg }}>
                                    <span className={cn('text-white font-bold leading-none', index > 99 ? 'text-[7px]' : index > 9 ? 'text-[9px]' : 'text-[10px]')}>{index}</span>
                                </span>
                            )}
                            <div className="min-w-0">
                                <h3 className={cn('text-[clamp(0.6875rem,1.5vw,0.875rem)] font-semibold line-clamp-2 leading-tight', !immersive && 'text-slate-900 dark:text-white')}
                                    style={{ color: textColor }}>
                                    {property.name}
                                </h3>
                                {property.location && (
                                    <p className={cn('text-[10px] leading-tight mt-0.5 truncate flex items-center gap-0.5', !immersive && 'text-slate-400 dark:text-slate-500')}
                                        style={{ color: dimColor }}>
                                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                                        {property.location}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-end justify-between mt-1.5">
                        <div className="flex items-center gap-1.5">
                            {rating > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                    <StarRating rating={rating} size={12} accent={starAccent} emptyColor={starEmpty} />
                                    <div className="flex items-center gap-1">
                                        <span className={cn('text-[10px] font-medium leading-none', !immersive && 'text-slate-600 dark:text-slate-400')} style={{ color: dimColor }}>
                                            {rating.toFixed(1)} · {ratingLabel}
                                        </span>
                                    </div>
                                    {(property.reviewCount ?? 0) > 0 && (
                                        <span className={cn('text-[10px] leading-none', !immersive && 'text-slate-400')} style={{ color: dimColor }}>
                                            {(property.reviewCount!).toLocaleString()} reviews
                                        </span>
                                    )}
                                </div>
                            ) : starRating > 0 ? (
                                <StarRating rating={starRating * 2} size={12} accent={starAccent} emptyColor={starEmpty} />
                            ) : null}
                        </div>

                        <div className="text-right shrink-0">
                            {property.priceLoading ? (
                                <div className="flex flex-col items-end gap-1">
                                    <div className={cn('h-4 w-20 rounded animate-pulse', !immersive && 'bg-slate-200 dark:bg-slate-700')} style={{ background: skeletonBg }} />
                                    <div className={cn('h-3 w-10 rounded animate-pulse', !immersive && 'bg-slate-100 dark:bg-slate-800')} style={immersive ? { background: 'rgba(255,255,255,0.05)' } : undefined} />
                                </div>
                            ) : (
                                <>
                                    {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                                        <span className={cn('text-[10px] line-through block leading-none', !immersive && 'text-slate-400')} style={{ color: dimColor }}>
                                            {formatCurrency(displayOriginalPrice, targetCurrency)}
                                        </span>
                                    )}
                                    <span className={cn('text-[clamp(0.6875rem,1.5vw,0.875rem)] font-bold', !immersive && 'text-blue-600 dark:text-blue-400')} style={{ color: priceColor }}>
                                        {formatCurrency(displayPrice, targetCurrency)}
                                    </span>
                                    <span className={cn('text-[10px] ml-0.5', !immersive && 'text-slate-400')} style={{ color: dimColor }}>/night</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
