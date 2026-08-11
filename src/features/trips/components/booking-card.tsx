'use client';

import React from 'react';
import Link from 'next/link';
import { Plane, Hotel, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import type { AnyBooking, HotelBooking, FlightBooking } from '@/shared/types';

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
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

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
                            View Details
                            <ChevronRight size={13} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Flight Card ──────────────────────────────────────────────────────────────

function FlightCard({ booking }: { booking: FlightBooking }) {
    const segments = booking.flight_segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    const origin = first?.origin ?? '—';
    const destination = last?.destination ?? '—';
    const airline = first?.airline ?? null;
    const departDate = first?.departure ? formatDate(new Date(first.departure), { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const tripTypeLabel = booking.trip_type === 'round-trip' ? 'Round-trip' : booking.trip_type === 'multi-city' ? 'Multi-city' : 'One-way';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
            <div className="flex min-h-[100px]">
                {/* Airline logo / Icon */}
                <div className="relative w-24 sm:w-32 flex-shrink-0 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700">
                    {airline ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={`https://images.kiwi.com/airlines/64/${airline}.png`}
                            alt={airline}
                            className="w-14 h-14 object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.nextSibling as HTMLElement | null)?.style.removeProperty('display');
                            }}
                        />
                    ) : null}
                    <div className={cn('flex items-center justify-center', airline ? 'hidden' : '')}>
                        <Plane size={24} className="text-blue-500" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 px-3 py-2.5 flex flex-col gap-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight flex items-center gap-1.5">
                                <Plane size={13} className="text-blue-500 shrink-0" />
                                {origin} → {destination}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {departDate} · <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-[10px]">{tripTypeLabel}</span>
                            </p>
                        </div>
                        <StatusBadge status={booking.status} isHotel={false} />
                    </div>

                    {booking.pnr && (
                        <p className="text-xs text-slate-400 font-mono">
                            PNR: {booking.pnr}
                        </p>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(booking.charged_price ?? booking.total_price, booking.currency)}
                        </span>
                        <Link
                            href={`/trips/${booking.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                            View Details
                            <ChevronRight size={13} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { FlightBookingCard } from '@/app/trips/components/FlightBookingCard';

// ─── Exports ──────────────────────────────────────────────────────────────────

export function BookingCard({ booking }: { booking: AnyBooking }) {
    if (booking.type === 'hotel') {
        return <HotelCard booking={booking} />;
    }
    return <FlightBookingCard booking={booking} />;
}
