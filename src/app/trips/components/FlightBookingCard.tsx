'use client';

import React from 'react';
import Link from 'next/link';
import { Plane, ChevronRight, Calendar, Tag, Download, Ticket } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import type { FlightBooking } from '@/shared/types';
import { toast } from 'sonner';

const FLIGHT_STATUS_MAP: Record<string, { label: string; color: string }> = {
    booked:                    { label: 'Processing',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    pnr_created:               { label: 'Booked',              color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    awaiting_ticket:           { label: 'Ticketing',           color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    ticketed:                  { label: 'Confirmed',           color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    failed:                    { label: 'Failed',              color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    cancel_requested:          { label: 'Cancel Pending',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    cancel_failed:             { label: 'Cancel Failed',       color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    cancelled:                 { label: 'Cancelled',           color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
    refund_pending:            { label: 'Refund Pending',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    refund_failed:             { label: 'Refund Failed',       color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    refunded:                  { label: 'Refunded',            color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    cancelled_provider_missing:{ label: 'Cancelled',           color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = FLIGHT_STATUS_MAP[status] ?? { label: status, color: 'bg-slate-100 text-slate-600' };
    return (
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide', cfg.color)}>
            {cfg.label}
        </span>
    );
}

interface FlightBookingCardProps {
    booking: FlightBooking;
}

export function FlightBookingCard({ booking }: FlightBookingCardProps) {
    const segments = booking.flight_segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    const origin = first?.origin ?? '—';
    const destination = last?.destination ?? '—';
    const airline = first?.airline ?? null;
    const departDate = first?.departure ? formatDate(new Date(first.departure), { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const tripTypeLabel = booking.trip_type === 'round-trip' ? 'Round-trip' : booking.trip_type === 'multi-city' ? 'Multi-city' : 'One-way';

    // Format times
    const formatTime = (iso?: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const handleDownloadTicket = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toast.success('Downloading E-Ticket...');
        
        // Trigger download of mock e-ticket text
        const text = `CHEAPESTGO FLIGHT E-TICKET\n\nPNR: ${booking.pnr || 'N/A'}\nRoute: ${origin} -> ${destination}\nDate: ${departDate}\nStatus: ${booking.status}\n\nThank you for booking with CheapestGo!`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `eticket-${booking.pnr || 'flight'}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 group">
            <div className="flex flex-col sm:flex-row min-h-[120px]">
                {/* Left Side: Logo & Icon Container */}
                <div className="relative w-full sm:w-32 bg-slate-50 dark:bg-slate-900/50 flex sm:flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-white/5 gap-3 shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        {airline ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`https://images.kiwi.com/airlines/64/${airline}.png`}
                                alt={airline}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    (e.currentTarget.nextSibling as HTMLElement | null)?.style.removeProperty('display');
                                }}
                            />
                        ) : null}
                        <Plane size={22} className={cn("shrink-0", airline ? "hidden" : "")} />
                    </div>
                    <div className="text-center hidden sm:block">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Flight
                        </span>
                    </div>
                </div>

                {/* Right Side: Booking Details Content */}
                <div className="flex-1 p-5 flex flex-col gap-2 min-w-0">
                    {/* Header: Cities & Status */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate leading-snug flex items-center gap-2">
                                {origin} <span className="text-blue-500">→</span> {destination}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span className="flex items-center gap-1">
                                    <Calendar size={12} className="text-slate-400" />
                                    {departDate}
                                </span>
                                {first?.departure && (
                                    <span className="text-slate-400">
                                        ({formatTime(first.departure)})
                                    </span>
                                )}
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {tripTypeLabel}
                                </span>
                            </div>
                        </div>
                        <StatusBadge status={booking.status} />
                    </div>

                    {/* Meta info: PNR Locator */}
                    {booking.pnr && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <Ticket size={12} className="text-slate-400" />
                            <span>PNR: <strong className="text-slate-700 dark:text-slate-300 font-semibold tracking-wider">{booking.pnr}</strong></span>
                        </div>
                    )}

                    {/* Footer: Price & Details Link */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-900 dark:text-white">
                                {formatCurrency(booking.charged_price ?? booking.total_price, booking.currency)}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            {booking.status === 'ticketed' && (
                                <button
                                    onClick={handleDownloadTicket}
                                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl"
                                    title="Download E-Ticket"
                                >
                                    <Download size={13} />
                                    <span>E-Ticket</span>
                                </button>
                            )}

                            <Link
                                href={`/trips/${booking.id}`}
                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                                <span>Details</span>
                                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
