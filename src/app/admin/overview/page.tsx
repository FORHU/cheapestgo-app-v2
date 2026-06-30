'use client';

import { useEffect, useState } from 'react';
import { Info, BookOpen, DollarSign, Users, Hotel } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { BookingsTable } from '@/features/admin/components/bookings-table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Booking, PaginatedResponse } from '@/shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
    totalBookings: number;
    totalRevenue:  number;
    activeUsers:   number;
    hotelDeals:    number;
    currency:      string;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
            ))}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
    const [stats, setStats]         = useState<AdminStats | null>(null);
    const [statsError, setStatsError] = useState(false);
    const [bookings, setBookings]   = useState<Booking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);

    useEffect(() => {
        // Try to load stats — endpoint may not exist in api-v2 yet
        http.get<AdminStats>('/api/admin/stats')
            .then(setStats)
            .catch(() => setStatsError(true));

        // Load recent bookings
        http.get<PaginatedResponse<Booking>>('/api/bookings?page=1&pageSize=10')
            .then(res => setBookings(res.data ?? []))
            .catch(() => setBookings([]))
            .finally(() => setBookingsLoading(false));
    }, []);

    return (
        <div className="p-6 space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-xl font-bold text-slate-900">Overview</h1>
                <p className="text-sm text-slate-500 mt-0.5">Platform-wide snapshot</p>
            </div>

            {/* Stats */}
            {statsError ? (
                <div>
                    <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
                        <Info size={15} className="shrink-0" />
                        Stats endpoint not available yet — showing placeholder data.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard label="Total Bookings" value="—" />
                        <StatsCard label="Revenue"        value="—" prefix="$" />
                        <StatsCard label="Active Users"   value="—" />
                        <StatsCard label="Hotel Deals"    value="—" />
                    </div>
                </div>
            ) : stats === null ? (
                <StatsSkeleton />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        label="Total Bookings"
                        value={stats.totalBookings.toLocaleString()}
                    />
                    <StatsCard
                        label="Revenue"
                        value={stats.totalRevenue.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })}
                        prefix={stats.currency}
                    />
                    <StatsCard label="Active Users" value={stats.activeUsers.toLocaleString()} />
                    <StatsCard label="Hotel Deals"  value={stats.hotelDeals.toLocaleString()} />
                </div>
            )}

            {/* Stats icons row — decorative context */}
            {!statsError && stats === null && null}

            {/* Recent Bookings */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-900">Recent Bookings</h2>
                    <a href="/admin/bookings" className="text-xs text-blue-600 hover:underline font-medium">
                        View all →
                    </a>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                    {bookingsLoading ? (
                        <div className="p-6 space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-8 w-full" />
                            ))}
                        </div>
                    ) : (
                        <BookingsTable bookings={bookings} />
                    )}
                </div>
            </section>
        </div>
    );
}
