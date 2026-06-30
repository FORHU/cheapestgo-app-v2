'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Luggage, ArrowRight, Hotel, Plane } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { BookingCard } from './booking-card';
import type { AnyBooking } from '@/shared/types';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
            <div className="flex min-h-[100px]">
                <div className="w-24 sm:w-32 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                <div className="flex-1 px-3 py-2.5 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </div>
            </div>
        </div>
    );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabValue = 'all' | 'hotels' | 'flights';

const TABS: { id: TabValue; label: string; icon: React.ReactNode }[] = [
    { id: 'all',     label: 'All',     icon: <Luggage size={13} /> },
    { id: 'hotels',  label: 'Hotels',  icon: <Hotel size={13} /> },
    { id: 'flights', label: 'Flights', icon: <Plane size={13} /> },
];

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabValue }) {
    const msg = tab === 'hotels' ? 'No hotel bookings yet' : tab === 'flights' ? 'No flight bookings yet' : 'No trips yet';
    return (
        <div className="flex flex-col items-center text-center py-20 px-4">
            <div className="w-16 h-16 mb-4 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center">
                <Luggage size={28} className="text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{msg}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Ready to explore? Find flights and hotels at the best prices.
            </p>
            <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
            >
                Explore destinations
                <ArrowRight size={14} />
            </Link>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TripsList() {
    const router = useRouter();
    const [bookings, setBookings] = useState<AnyBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabValue>('all');

    useEffect(() => {
        setIsLoading(true);
        http.get<AnyBooking[]>('/api/bookings')
            .then(setBookings)
            .catch((err: Error & { status?: number }) => {
                if (err.status === 401) {
                    router.push('/login?next=/trips');
                }
            })
            .finally(() => setIsLoading(false));
    }, [router]);

    const filtered = bookings.filter(b => {
        if (activeTab === 'hotels') return b.type === 'hotel';
        if (activeTab === 'flights') return b.type === 'flight';
        return true;
    });

    return (
        <div>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-white/10">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap',
                            activeTab === tab.id
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState tab={activeTab} />
            ) : (
                <div className="space-y-3">
                    {filtered.map(booking => (
                        <BookingCard key={booking.id} booking={booking} />
                    ))}
                </div>
            )}
        </div>
    );
}
