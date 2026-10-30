'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { Luggage, Hotel, Plane, CloudOff } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { BookingCard } from './booking-card';
import { BookingCardSkeleton, CHIP } from './booking-card-parts';
import { fetchBookings } from '../lib/bookings-api';
import type { AnyBooking } from '@/shared/types';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabValue = 'all' | 'hotels' | 'flights';

const TABS: { id: TabValue; label: string; icon: React.ReactNode }[] = [
    { id: 'all',     label: 'All',     icon: <Luggage size={15} aria-hidden /> },
    { id: 'hotels',  label: 'Hotels',  icon: <Hotel size={15} aria-hidden /> },
    { id: 'flights', label: 'Flights', icon: <Plane size={15} aria-hidden /> },
];

/**
 * The results sidebar's rows, laid out as a row of pills: the selected one in the brand
 * gradient, as a chosen sort is (`filter-panel.tsx`); the rest on the cards' white plate,
 * since they sit on the page ground rather than inside a panel.
 */
const TAB_IDLE = 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-white/90 dark:hover:bg-white/8';

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabValue }) {
    const tAll = useTranslations();
    const msg = tab === 'hotels' ? 'No hotel bookings yet' : tab === 'flights' ? 'No flight bookings yet' : 'No trips yet';
    return (
        <StateScreen
            icon={Luggage}
            title={msg}
            lines={[tAll('trips.emptyHint')]}
            className="rounded-2xl"
            actions={
                <Link href="/" className={stateActionClass}>
                    {tAll('trips.exploreDestinations')}
                </Link>
            }
        />
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TripsList() {
    const router = useRouter();
    const [bookings, setBookings] = useState<AnyBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabValue>('all');
    /** A load that failed is not an empty list, and must not be drawn as one. */
    const [loadFailed, setLoadFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const tAll = useTranslations();

    useEffect(() => {
        setIsLoading(true);
        setLoadFailed(false);
        fetchBookings(http)
            .then(setBookings)
            .catch((err: Error & { status?: number }) => {
                if (err.status === 401) {
                    router.push('/login?next=/trips');
                } else {
                    setLoadFailed(true);
                }
            })
            .finally(() => setIsLoading(false));
    }, [router, attempt]);

    const filtered = bookings.filter(b => {
        if (activeTab === 'hotels') return b.type === 'hotel';
        if (activeTab === 'flights') return b.type === 'flight';
        return true;
    });

    // Each tab says how many trips are behind it, as a sidebar row says how many results —
    // but only once there is a count to give.
    const counts: Record<TabValue, number> = {
        all:     bookings.length,
        hotels:  bookings.filter(b => b.type === 'hotel').length,
        flights: bookings.filter(b => b.type === 'flight').length,
    };
    const showCounts = !isLoading && !loadFailed;

    return (
        <div>
            {/* Tabs */}
            <div role="group" aria-label={tAll('trips.myTrips')} className="mb-5 flex flex-wrap gap-2">
                {TABS.map(tab => {
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            aria-pressed={active}
                            className={cn(
                                'inline-flex h-10 items-center gap-2 rounded-full px-5 text-[15px] whitespace-nowrap transition-colors',
                                active ? CHIP : TAB_IDLE,
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            {showCounts && (
                                <span className={cn('text-[12px]', active ? 'opacity-90' : 'opacity-60')}>{counts[tab.id]}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-4">
                    <BookingCardSkeleton />
                    <BookingCardSkeleton />
                    <BookingCardSkeleton />
                </div>
            ) : loadFailed ? (
                <StateScreen
                    icon={CloudOff}
                    title={tAll('trips.loadFailed.title')}
                    className="rounded-2xl"
                    actions={
                        <button type="button" onClick={() => setAttempt(a => a + 1)} className={stateActionClass}>
                            {tAll('trips.loadFailed.retry')}
                        </button>
                    }
                />
            ) : filtered.length === 0 ? (
                <EmptyState tab={activeTab} />
            ) : (
                <div className="space-y-4">
                    {filtered.map((booking, i) => (
                        <BookingCard key={booking.id} booking={booking} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}
