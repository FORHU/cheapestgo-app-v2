'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SaveButton } from './save-button';
import { useMoney } from '@/features/landing/lib/money';
import {
    flightSearchUrl, hotelSearchUrl, propertyUrl, type TripDates,
} from '@/features/landing/lib/links';
import type { BundleItem, FlightDealItem, StayItem } from '@/features/landing/lib/landing-data';
import { useTravelers } from '@/shared/stores/search.store';
import { useHydrated } from '@/shared/hooks/useHydrated';

const CARD = 'snap-start shrink-0 w-[250px] block group';
const MEDIA = 'relative h-[200px] rounded-[16px] overflow-hidden mb-3 bg-slate-200 dark:bg-slate-800';
const IMG = 'object-cover transition-transform duration-500 group-hover:scale-[1.04]';
const SIZES = '250px';

/**
 * Traveler counts for card deep links. Falls back to the store's own defaults
 * until hydration so the server-rendered `href` matches the first client render.
 */
const DEFAULT_TRAVELERS = { adults: 2, children: 0, rooms: 1 };

function useLinkTravelers() {
    const travelers = useTravelers();
    const hydrated = useHydrated();
    return hydrated ? travelers : DEFAULT_TRAVELERS;
}

// ─── Flight deal ──────────────────────────────────────────────────────────────

export function FlightDealCard({
    deal, dates, priority,
}: { deal: FlightDealItem; dates: TripDates; priority?: boolean }) {
    const money = useMoney();
    const { adults, children } = useLinkTravelers();

    const href = flightSearchUrl({
        origin: deal.origin,
        destination: deal.code,
        depart: deal.departDate ?? dates.depart,
        ret: deal.returnDate ?? dates.ret,
        cabin: deal.cabinClass,
        adults: Math.max(1, adults),
        children,
    });

    return (
        <Link href={href} className={CARD}>
            <div className={MEDIA}>
                <Image src={deal.image} alt={deal.city} fill sizes={SIZES} className={IMG} priority={priority} />
                <span className="absolute top-2.5 left-2.5 z-10 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-900 bg-white/90 px-2.5 py-[5px] rounded-full">
                    {deal.tag}
                </span>
                <SaveButton itemKey={`flight:${deal.origin}-${deal.code}`} label={`flight to ${deal.city}`} />
            </div>

            <div className="flex items-baseline justify-between gap-2.5">
                <span className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{deal.city}</span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white shrink-0">
                    {money(deal.price, deal.currency)}
                </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-[3px] truncate">{deal.detail}</div>
        </Link>
    );
}

// ─── Stay ─────────────────────────────────────────────────────────────────────

export function StayCard({
    stay, dates, priority,
}: { stay: StayItem; dates: TripDates; priority?: boolean }) {
    const money = useMoney();
    const { adults, children, rooms } = useLinkTravelers();

    const query = {
        destination: stay.city || stay.name,
        checkIn: stay.checkIn ?? dates.depart,
        checkOut: stay.checkOut ?? dates.ret,
        adults: Math.max(1, adults),
        children,
        rooms,
    };
    const href = stay.propertyId ? propertyUrl(stay.propertyId, query) : hotelSearchUrl(query);

    return (
        <Link href={href} className={CARD}>
            <div className={MEDIA}>
                <Image src={stay.image} alt={stay.name} fill sizes={SIZES} className={IMG} priority={priority} />
                <SaveButton itemKey={`stay:${stay.id}`} label={stay.name} />
            </div>

            <div className="flex items-baseline justify-between gap-2.5">
                <span className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{stay.name}</span>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 shrink-0">★ {stay.rating}</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-[3px] truncate">{stay.location}</div>
            <div className="font-mono text-[13px] font-bold mt-1.5 text-slate-900 dark:text-white">
                {money(stay.price, stay.currency)}{' '}
                <span className="font-normal text-slate-600 dark:text-slate-400">/ night</span>
            </div>
        </Link>
    );
}

// ─── Bundle (flight + hotel) ──────────────────────────────────────────────────

export function BundleCard({
    bundle, dates, priority,
}: { bundle: BundleItem; dates: TripDates; priority?: boolean }) {
    const money = useMoney();
    const { adults, children } = useLinkTravelers();

    const href = flightSearchUrl({
        origin: bundle.origin,
        destination: bundle.code,
        depart: dates.depart,
        ret: dates.ret,
        adults: Math.max(1, adults),
        children,
    });

    return (
        <Link href={href} className={CARD}>
            <div className={MEDIA}>
                <Image src={bundle.image} alt={bundle.city} fill sizes={SIZES} className={IMG} priority={priority} />
                <SaveButton itemKey={`bundle:${bundle.code}`} label={`${bundle.city} bundle`} />
            </div>

            <div className="flex items-baseline justify-between gap-2.5">
                <span className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{bundle.city}</span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white shrink-0">
                    {money(bundle.total, bundle.currency)}
                </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-[3px] truncate">
                {bundle.origin} → {bundle.code} · {bundle.stops === 0 ? 'Nonstop' : `${bundle.stops} stop`} · {bundle.nights} nights
            </div>
            <div className="font-mono text-xs text-slate-400 dark:text-slate-500 mt-1.5 truncate">
                {money(bundle.flight, bundle.currency)} flight + {money(bundle.hotelPerNight, bundle.currency)}/night
            </div>
        </Link>
    );
}
