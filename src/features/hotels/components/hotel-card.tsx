'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/components/ui/button';

export interface HotelResult {
    id: string;
    hotelId?: string;
    name: string;
    /** Address / neighbourhood shown under the name */
    location?: string;
    city?: string;
    country?: string;
    starRating?: number;
    /** 0–10 guest review score */
    reviewScore?: number;
    reviewCount?: number;
    /** Nightly rate in `currency` */
    price: number;
    currency: string;
    images?: string[];
    /** e.g. "RFN" = free cancellation */
    refundableTag?: string;
    boardType?: string;
    /** Extra search-result metadata forwarded to the detail page */
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    rooms?: number;
    /** Coordinates returned by the search API (used by map view) */
    lat?: number;
    lng?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRatingLabel(score: number): string {
    if (score >= 9) return 'Exceptional';
    if (score >= 8) return 'Excellent';
    if (score >= 7) return 'Very Good';
    if (score >= 6) return 'Good';
    if (score >= 5) return 'Average';
    return 'Fair';
}

function getRatingBg(score: number): string {
    if (score >= 9) return 'bg-emerald-600';
    if (score >= 8) return 'bg-blue-600';
    if (score >= 7) return 'bg-blue-500';
    if (score >= 6) return 'bg-amber-500';
    return 'bg-orange-500';
}

function StarRating({ stars }: { stars: number }) {
    const count = Math.min(5, Math.max(1, Math.round(stars)));
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={11}
                    className={cn(
                        i < count ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700 fill-current',
                    )}
                />
            ))}
        </div>
    );
}

// ─── Hotel Card ───────────────────────────────────────────────────────────────

interface HotelCardProps {
    hotel: HotelResult;
    index?: number;
    searchQs?: string;
}

export function HotelCard({ hotel, index = 0, searchQs = '' }: HotelCardProps) {
    const image = hotel.images?.[0];
    const locationText = [hotel.location, hotel.city, hotel.country].filter(Boolean).join(', ') || hotel.city || '';
    const detailHref = `/property/${hotel.id}${searchQs ? `?${searchQs}` : ''}`;

    return (
        <Link
            href={detailHref}
            className="group flex flex-col md:flex-row bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all overflow-hidden"
        >
            {/* Image */}
            <div className="relative md:w-[220px] h-[140px] md:h-auto shrink-0">
                {image ? (
                    <Image
                        src={image}
                        alt={hotel.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 220px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={index === 0 ? undefined : 'lazy'}
                        priority={index === 0}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                        <svg viewBox="0 0 64 64" className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="currentColor">
                            <rect x="8" y="20" width="48" height="36" rx="2" />
                            <rect x="14" y="28" width="8" height="8" fill="white" opacity="0.6" />
                            <rect x="28" y="28" width="8" height="8" fill="white" opacity="0.6" />
                            <rect x="42" y="28" width="8" height="8" fill="white" opacity="0.6" />
                            <rect x="30" y="50" width="4" height="6" fill="white" opacity="0.6" />
                        </svg>
                    </div>
                )}

                {/* Free cancellation badge */}
                {hotel.refundableTag === 'RFN' && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[10px] font-semibold backdrop-blur-sm">
                        Free cancellation
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 p-3 md:p-4 flex flex-col justify-between min-w-0">
                <div className="space-y-1">
                    {/* Rank + name */}
                    <div className="flex items-center gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold leading-none">
                            {index + 1}
                        </span>
                        <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                            {hotel.name}
                        </h3>
                    </div>

                    {/* Star rating */}
                    {hotel.starRating && hotel.starRating > 0 && (
                        <StarRating stars={hotel.starRating} />
                    )}

                    {/* Location */}
                    {locationText && (
                        <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin size={11} className="shrink-0 text-blue-400" />
                            <span className="truncate">{locationText}</span>
                        </p>
                    )}

                    {/* Board type */}
                    {hotel.boardType && (
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            {hotel.boardType}
                        </span>
                    )}
                </div>

                {/* Bottom: review score + price + CTA */}
                <div className="flex items-end justify-between mt-3 gap-2">
                    {/* Review score */}
                    {hotel.reviewScore && hotel.reviewScore > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <span className={cn('px-1.5 py-0.5 rounded text-white text-xs font-bold', getRatingBg(hotel.reviewScore))}>
                                {hotel.reviewScore.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                {getRatingLabel(hotel.reviewScore)}
                            </span>
                            {hotel.reviewCount && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                    ({hotel.reviewCount.toLocaleString()})
                                </span>
                            )}
                        </div>
                    ) : (
                        <div />
                    )}

                    {/* Price + button */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    {hotel.currency} {hotel.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">/night</p>
                        </div>
                        <Button size="sm" className="hidden md:inline-flex shrink-0">
                            Book Now
                        </Button>
                    </div>
                </div>

                {/* Mobile Book Now */}
                <Button size="sm" fullWidth className="mt-3 md:hidden">
                    Book Now
                </Button>
            </div>
        </Link>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function HotelCardSkeleton() {
    return (
        <div className="flex flex-col md:flex-row bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 overflow-hidden animate-pulse">
            <div className="md:w-[220px] h-[140px] md:h-[160px] shrink-0 bg-slate-200 dark:bg-white/10" />
            <div className="flex-1 p-3 md:p-4 space-y-3">
                <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-3 w-1/4 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
                <div className="flex items-end justify-between mt-4">
                    <div className="h-6 w-16 rounded bg-slate-200 dark:bg-white/10" />
                    <div className="h-8 w-28 rounded-xl bg-slate-200 dark:bg-white/10" />
                </div>
            </div>
        </div>
    );
}
