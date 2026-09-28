'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { Link } from '@/i18n/navigation';
import { Hotel, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import type { AnyBooking, HotelBooking } from '@/shared/types';

// ─── Status badge config ──────────────────────────────────────────────────────

const HOTEL_STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    completed: { label: 'Completed', color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    cancelled_refunded: { label: 'Refunded', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    cancelled_refund_failed: { label: 'Refund Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const FLIGHT_STATUS_MAP: Record<string, { label: string; color: string }> = {
    booked: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    pnr_created: { label: 'Booked', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    awaiting_ticket: { label: 'Ticketing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    ticketed: { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    cancel_requested: { label: 'Cancel Pending', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    cancel_failed: { label: 'Cancel Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
    refund_pending: { label: 'Refund Pending', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    refund_failed: { label: 'Refund Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    refunded: { label: 'Refunded', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    cancelled_provider_missing: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
};

function StatusBadge({ status, isHotel }: { status: string; isHotel: boolean }) {
    const map = isHotel ? HOTEL_STATUS_MAP : FLIGHT_STATUS_MAP;
    const cfg = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-600' };
    return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', cfg.color)}>
            {cfg.label}
        </span>
    );
}

// ─── Hotel Card ───────────────────────────────────────────────────────────────

function HotelCard({ booking }: { booking: HotelBooking }) {
    const tAll = useTranslations();
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = nightsBetween(checkIn, checkOut) ?? 1;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
            <div className="flex min-h-[100px]">
                {/* Image/Icon */}
                <div className="relative w-24 sm:w-32 flex-shrink-0 overflow-hidden">
                    {booking.property_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={booking.property_image}
                            alt={booking.property_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Hotel size={24} className="text-white/60" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 px-3 py-2.5 flex flex-col gap-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                                {booking.property_name}
                            </p>
                            {booking.room_name && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                    <MapPin size={10} className="shrink-0" />
                                    {booking.room_name}
                                </p>
                            )}
                        </div>
                        <StatusBadge status={booking.status} isHotel={true} />
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar size={11} className="shrink-0" />
                        <span>
                            {formatDate(checkIn, { month: 'short', day: 'numeric' })}
                            {' → '}
                            {formatDate(checkOut, { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}
                            {nights} night{nights !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(booking.total_price, booking.currency)}
                        </span>
                        <Link
                            href={`/trips/${booking.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                            {tAll('trips.viewDetails')}
                            <ChevronRight size={13} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { FlightBookingCard } from '@/app/[locale]/trips/components/FlightBookingCard';
import { nightsBetween } from '@/shared/lib/stay';

// ─── Exports ──────────────────────────────────────────────────────────────────

export function BookingCard({ booking }: { booking: AnyBooking }) {
    if (booking.type === 'hotel') {
        return <HotelCard booking={booking} />;
    }
    return <FlightBookingCard booking={booking} />;
}
