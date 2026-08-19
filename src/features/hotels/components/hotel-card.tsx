'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, Building2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';

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

// ─── Saved hotels ─────────────────────────────────────────────────────────────
// The bookmark in the design has no server story attached to it yet, so it keeps
// its state locally — the same shape the flight SaveButton uses for its own
// list, minus the account sync.

const SAVED_KEY = 'cheapestgo-saved-hotels';

function readSaved(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(SAVED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * `saved` starts false on both server and client and only picks up localStorage
 * after mount, so the first paint matches the server's and hydration stays
 * quiet.
 */
function useSavedHotel(id: string) {
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setSaved(readSaved().includes(id));
    }, [id]);

    const toggle = useCallback(() => {
        const list = readSaved();
        const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
        try {
            localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        } catch { /* private mode — the toggle still reads as pressed for this session */ }
        setSaved(next.includes(id));
    }, [id]);

    return { saved, toggle };
}

// ─── Hotel Card ───────────────────────────────────────────────────────────────

interface HotelCardProps {
    hotel: HotelResult;
    index?: number;
    searchQs?: string;
}

/**
 * The map view's rail-card palette, as Tailwind pairs — same surface, same
 * inverted chip, so a stay looks identical whichever view you found it in.
 * Mirrors `railCardPalette` in the search page.
 */
const SURFACE = 'bg-white dark:bg-[#1A1A1A]';
const TITLE   = 'text-[#111111] dark:text-white';
const MUTED   = 'text-[#6B7280] dark:text-white/60';
const IMAGE_BG = 'bg-[#F1F1F1] dark:bg-white/5';
/** Inverted against the card surface: near-black chip on white, white on dark. */
const CHIP    = 'bg-[#1A1A1A] text-white dark:bg-white dark:text-[#111111]';

export function HotelCard({ hotel, index = 0, searchQs = '' }: HotelCardProps) {
    const image = hotel.images?.[0];
    const locationText =
        [hotel.location, hotel.city, hotel.country].filter(Boolean).join(', ') || hotel.city || '';
    const detailHref = `/property/${hotel.id}${searchQs ? `?${searchQs}` : ''}`;
    const priceLabel = `${formatCurrency(hotel.price, hotel.currency)}/ night`;
    const rating = hotel.reviewScore ?? 0;

    const { saved, toggle } = useSavedHotel(hotel.id);

    return (
        <article className={cn('group relative overflow-hidden rounded-2xl transition-shadow hover:shadow-lg dark:hover:shadow-black/40', SURFACE)}>
            {/* Whole-card link, stretched under the content. The actions that
                follow sit above it on their own z-index rather than nested
                inside an anchor. */}
            <Link
                href={detailHref}
                aria-label={hotel.name}
                className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            />

            <div className="flex flex-col md:h-[205px] md:flex-row">
                {/* Photo */}
                <div className={cn('relative h-[190px] w-full shrink-0 overflow-hidden md:h-full md:w-[240px] lg:w-[305px]', IMAGE_BG)}>
                    {image ? (
                        <Image
                            src={image}
                            alt={hotel.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 305px"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            loading={index === 0 ? undefined : 'lazy'}
                            priority={index === 0}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Building2 size={30} className="text-slate-300 dark:text-white/25" />
                        </div>
                    )}
                </div>

                {/* Details.
                    Laid out from the top, NOT `justify-between`: the four lines
                    are one stack on an even rhythm, and distributing free space
                    between them would open a gap under the rating that the
                    design does not have. What sets the price line's position is
                    its own `mt-2`, the same step the lines above it take. */}
                <div className="flex min-w-0 flex-1 flex-col px-6 py-6 md:pt-[30px] md:pb-[30px] md:pr-8 md:pl-10">
                    {/* Kept clear of the bookmark on the right */}
                    <div className="min-w-0 pr-14">
                        <h3 className={cn('truncate text-[20px] leading-tight font-bold', TITLE)}>
                            {hotel.name}
                        </h3>

                        <p className={cn('mt-2.5 truncate text-[14px]', MUTED)}>
                            {locationText || '—'}
                        </p>

                        <p className={cn('mt-2 text-[14px]', MUTED)}>
                            {rating > 0 ? `${rating.toFixed(1)} / 10 rating` : 'No rating yet'}
                        </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                        {/* Price. Truncates rather than wrapping: it shares the
                            row with a button that must keep its full width. */}
                        <p className={cn('min-w-0 truncate text-[17px]', MUTED)}>
                            {priceLabel}
                        </p>

                        {/* Book Now */}
                        <Link
                            href={detailHref}
                            className={cn(
                                'relative z-20 -my-2.5 inline-flex shrink-0 items-center justify-center rounded-full px-7 py-[10px] text-[15px] font-medium whitespace-nowrap transition-opacity hover:opacity-85',
                                CHIP,
                            )}
                        >
                            Book Now
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bookmark */}
            <button
                type="button"
                onClick={toggle}
                aria-label={saved ? 'Remove from saved stays' : 'Save this stay'}
                aria-pressed={saved}
                className={cn(
                    'absolute top-5 right-6 z-20 flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-85 md:top-6',
                    CHIP,
                )}
            >
                <Bookmark size={16} strokeWidth={1.75} className={cn(saved && 'fill-current')} />
            </button>
        </article>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function HotelCardSkeleton() {
    return (
        <div className={cn('flex animate-pulse flex-col overflow-hidden rounded-2xl md:h-[205px] md:flex-row', SURFACE)}>
            <div className="h-[190px] w-full shrink-0 bg-slate-200 md:h-full md:w-[240px] lg:w-[305px] dark:bg-white/10" />
            <div className="flex flex-1 flex-col justify-between px-6 py-6 md:py-[30px] md:pr-8 md:pl-10">
                <div className="space-y-3">
                    <div className="h-5 w-2/5 rounded bg-slate-200 dark:bg-white/10" />
                    <div className="h-3.5 w-3/5 rounded bg-slate-200 dark:bg-white/10" />
                    <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-white/10" />
                </div>
                <div className="mt-6 flex items-center justify-between">
                    <div className="h-10 w-32 rounded-[12px] bg-slate-200 dark:bg-white/10" />
                    <div className="h-10 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
                </div>
            </div>
        </div>
    );
}
