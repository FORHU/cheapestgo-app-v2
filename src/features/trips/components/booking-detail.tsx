'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Calendar, Users, Plane, Hotel,
    CreditCard, Shield, CheckCircle, XCircle,
    Clock, RotateCcw, AlertTriangle, Loader2,
} from 'lucide-react';
import { http } from '@/shared/lib/http';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { AnyBooking, HotelBooking, FlightBooking } from '@/shared/types';

// ─── Status maps ──────────────────────────────────────────────────────────────

const HOTEL_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending:                 { label: 'Pending',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    icon: <Clock size={13} /> },
    confirmed:               { label: 'Confirmed',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',    icon: <CheckCircle size={13} /> },
    completed:               { label: 'Completed',    color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',        icon: <CheckCircle size={13} /> },
    cancelled:               { label: 'Cancelled',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle size={13} /> },
    cancelled_refunded:      { label: 'Refunded',     color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',       icon: <RotateCcw size={13} /> },
    cancelled_refund_failed: { label: 'Refund Failed',color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: <AlertTriangle size={13} /> },
};

const FLIGHT_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    booked:                    { label: 'Processing',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     icon: <Clock size={13} /> },
    pnr_created:               { label: 'Booked',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     icon: <CheckCircle size={13} /> },
    awaiting_ticket:           { label: 'Ticketing',        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock size={13} /> },
    ticketed:                  { label: 'Confirmed',        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle size={13} /> },
    failed:                    { label: 'Failed',           color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: <XCircle size={13} /> },
    cancel_requested:          { label: 'Cancel Pending',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: <Clock size={13} /> },
    cancel_failed:             { label: 'Cancel Failed',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: <AlertTriangle size={13} /> },
    cancelled:                 { label: 'Cancelled',        color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',     icon: <XCircle size={13} /> },
    refund_pending:            { label: 'Refund Pending',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: <Clock size={13} /> },
    refund_failed:             { label: 'Refund Failed',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: <AlertTriangle size={13} /> },
    refunded:                  { label: 'Refunded',         color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',     icon: <RotateCcw size={13} /> },
    cancelled_provider_missing:{ label: 'Cancelled',        color: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',     icon: <XCircle size={13} /> },
};

function StatusBadge({ status, isHotel }: { status: string; isHotel: boolean }) {
    const map = isHotel ? HOTEL_STATUS : FLIGHT_STATUS;
    const cfg = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-600', icon: null };
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.color)}>
            {cfg.icon}
            {cfg.label}
        </span>
    );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white text-right">{value}</span>
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">{icon}</span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
            </div>
            <div className="px-5 py-1">{children}</div>
        </div>
    );
}

function fmtDate(s: string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...opts });
}

function fmtTime(s: string) {
    return new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─── Hotel Detail ─────────────────────────────────────────────────────────────

function HotelDetail({ booking }: { booking: HotelBooking }) {
    const [cancelling, setCancelling] = useState(false);
    const [cancelled, setCancelled] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const policy = booking.cancellation_policy;
    const refundable = policy?.refundableTag === 'RFN';
    const freeCancelDeadline = policy?.cancelPolicyInfos?.[0]?.cancelTime;

    const canCancel = !cancelled && (booking.status === 'confirmed' || booking.status === 'pending');

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;
        setCancelling(true);
        setCancelError(null);
        try {
            await http.post(`/api/bookings/${booking.id}/cancel`);
            setCancelled(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Cancellation failed. Please contact support.';
            setCancelError(msg);
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Hero */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {booking.property_image && (
                    <div className="relative h-48 w-full overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={booking.property_image} alt={booking.property_name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-4 left-5">
                            <h1 className="text-xl font-bold text-white">{booking.property_name}</h1>
                            {booking.room_name && <p className="text-sm text-white/80">{booking.room_name}</p>}
                        </div>
                    </div>
                )}
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                    {!booking.property_image && (
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Hotel size={18} className="text-blue-500" />
                                {booking.property_name}
                            </h1>
                            {booking.room_name && <p className="text-sm text-slate-500">{booking.room_name}</p>}
                        </div>
                    )}
                    <div className={cn('flex flex-col gap-1', !booking.property_image ? 'items-end' : 'w-full flex-row items-center justify-between')}>
                        <StatusBadge status={cancelled ? 'cancelled' : booking.status} isHotel={true} />
                        {booking.booking_id && (
                            <p className="text-xs text-slate-400 mt-0.5">Ref: <span className="font-mono">{booking.booking_id}</span></p>
                        )}
                    </div>
                </div>
            </div>

            {/* Stay Details */}
            <Section title="Stay Details" icon={<Calendar size={15} />}>
                <InfoRow label="Check-in" value={fmtDate(booking.check_in)} />
                <InfoRow label="Check-out" value={fmtDate(booking.check_out)} />
                <InfoRow label="Duration" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
                {booking.room_name && <InfoRow label="Room" value={booking.room_name} />}
                <InfoRow
                    label="Guests"
                    value={`${booking.guests_adults} adult${booking.guests_adults !== 1 ? 's' : ''}${booking.guests_children > 0 ? `, ${booking.guests_children} child${booking.guests_children !== 1 ? 'ren' : ''}` : ''}`}
                />
                {booking.special_requests && <InfoRow label="Special Requests" value={booking.special_requests} />}
            </Section>

            {/* Guest info */}
            {(booking.holder_first_name || booking.holder_email) && (
                <Section title="Guest Information" icon={<Users size={15} />}>
                    {(booking.holder_first_name || booking.holder_last_name) && (
                        <InfoRow label="Name" value={`${booking.holder_first_name ?? ''} ${booking.holder_last_name ?? ''}`.trim()} />
                    )}
                    {booking.holder_email && <InfoRow label="Email" value={booking.holder_email} />}
                </Section>
            )}

            {/* Cancellation policy */}
            <Section title="Cancellation Policy" icon={<Shield size={15} />}>
                <div className="py-3">
                    <div className={cn('flex items-center gap-2 mb-3 p-3 rounded-xl', refundable ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                        {refundable
                            ? <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                            : <XCircle size={16} className="text-red-500 shrink-0" />}
                        <span className={cn('text-sm font-semibold', refundable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {refundable ? 'Free cancellation available' : 'Non-refundable'}
                        </span>
                    </div>
                    {freeCancelDeadline && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Free cancellation until{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {fmtDate(freeCancelDeadline, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                        </p>
                    )}
                    {policy?.cancelPolicyInfos?.map((p, i) => (
                        <div key={i} className="mt-2 text-xs text-slate-500">
                            After {fmtDate(p.cancelTime)}: penalty of {formatCurrency(p.amount, p.currency ?? booking.currency)}
                        </div>
                    ))}
                    {policy?.hotelRemarks?.map((r, i) => (
                        <p key={i} className="mt-1.5 text-xs text-slate-400 italic">{r}</p>
                    ))}
                    {!policy && <p className="text-xs text-slate-400">Cancellation policy details not available.</p>}
                </div>
            </Section>

            {/* Payment */}
            <Section title="Payment" icon={<CreditCard size={15} />}>
                <InfoRow label="Total Paid" value={<span className="text-base font-bold">{formatCurrency(booking.total_price, booking.currency)}</span>} />
                <InfoRow label="Payment Method" value="Card (Stripe)" />
                <InfoRow label="Booked On" value={fmtDate(booking.created_at)} />
            </Section>

            {/* Cancel action */}
            {canCancel && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    {cancelError && (
                        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400">
                            {cancelError}
                        </div>
                    )}
                    <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        {cancelling ? 'Cancelling…' : 'Cancel Booking'}
                    </button>
                </div>
            )}
            {cancelled && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle size={16} />
                    Booking cancelled successfully.
                </div>
            )}
        </div>
    );
}

// ─── Flight Detail ────────────────────────────────────────────────────────────

function FlightDetail({ booking }: { booking: FlightBooking }) {
    const [cancelling, setCancelling] = useState(false);
    const [cancelled, setCancelled] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const segments = booking.flight_segments ?? [];
    const passengers = booking.passengers ?? [];
    const origin = segments[0]?.origin ?? '—';
    const destination = segments[segments.length - 1]?.destination ?? '—';
    const departDate = segments[0]?.departure ? fmtDate(segments[0].departure) : '—';

    const CANCELLABLE = new Set(['ticketed', 'booked', 'pnr_created', 'awaiting_ticket', 'cancel_failed']);
    const canCancel = !cancelled && CANCELLABLE.has(booking.status);

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this flight booking? This action cannot be undone.')) return;
        setCancelling(true);
        setCancelError(null);
        try {
            await http.post(`/api/bookings/${booking.id}/cancel`);
            setCancelled(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Cancellation failed. Please contact support.';
            setCancelError(msg);
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Hero */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                    <Plane size={18} className="text-blue-500" />
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                        {origin} → {destination}
                    </h1>
                </div>
                <p className="text-sm text-slate-500 mb-3">
                    {departDate} · {booking.trip_type ?? 'one-way'}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={cancelled ? 'cancelled' : booking.status} isHotel={false} />
                    {booking.pnr && (
                        <span className="text-xs text-slate-500">
                            PNR: <span className="font-mono font-semibold text-slate-800 dark:text-white tracking-wider">{booking.pnr}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Itinerary */}
            <Section title="Itinerary" icon={<Plane size={15} />}>
                <div className="py-2 space-y-0">
                    {segments.map((seg, i) => (
                        <div key={i} className="flex gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <div className="flex flex-col items-center pt-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                {i < segments.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {seg.origin} → {seg.destination}
                                    </span>
                                    {(seg.airline || seg.flight_number) && (
                                        <span className="text-xs font-mono text-slate-500 shrink-0">
                                            {seg.airline} {seg.flight_number}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    {seg.departure && (
                                        <span>{fmtDate(seg.departure)} · {fmtTime(seg.departure)}</span>
                                    )}
                                    {seg.arrival && (
                                        <><span>→</span><span>{fmtTime(seg.arrival)}</span></>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {segments.length === 0 && (
                        <p className="text-sm text-slate-400 py-3">No segment details available.</p>
                    )}
                </div>
            </Section>

            {/* Passengers */}
            {passengers.length > 0 && (
                <Section title="Passengers" icon={<Users size={15} />}>
                    {passengers.map((p, i) => (
                        <div key={i} className="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                        {p.first_name} {p.last_name}
                                        {p.type && <span className="ml-2 text-xs font-normal text-slate-400">({p.type})</span>}
                                    </p>
                                    {p.ticket_number && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                                            E-Ticket: {p.ticket_number}
                                        </p>
                                    )}
                                    {p.seat_number && (
                                        <p className="text-xs text-slate-400 mt-0.5">Seat {p.seat_number}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </Section>
            )}

            {/* Payment */}
            <Section title="Payment" icon={<CreditCard size={15} />}>
                <InfoRow label="Total Paid" value={<span className="text-base font-bold">{formatCurrency(booking.charged_price ?? booking.total_price, booking.currency)}</span>} />
                {booking.provider && <InfoRow label="Provider" value={<span className="capitalize">{booking.provider}</span>} />}
                <InfoRow label="Booked On" value={fmtDate(booking.created_at)} />
            </Section>

            {/* Cancel action */}
            {canCancel && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    {cancelError && (
                        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400">
                            {cancelError}
                        </div>
                    )}
                    <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        {cancelling ? 'Cancelling…' : 'Cancel Booking'}
                    </button>
                    <p className="mt-2 text-[10px] text-slate-400 text-center">
                        Refund eligibility is subject to airline fare rules.
                    </p>
                </div>
            )}
            {cancelled && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle size={16} />
                    Booking cancelled successfully. Refund will be processed per airline policy.
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BookingDetailProps {
    id: string;
}

export function BookingDetail({ id }: BookingDetailProps) {
    const router = useRouter();
    const [booking, setBooking] = useState<AnyBooking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        http.get<AnyBooking>(`/api/bookings/${id}`)
            .then(setBooking)
            .catch((err: Error & { status?: number }) => {
                if (err.status === 401) {
                    router.push(`/login?next=/trips/${id}`);
                } else if (err.status === 404) {
                    setError('Booking not found.');
                } else {
                    setError(err.message ?? 'Failed to load booking.');
                }
            })
            .finally(() => setIsLoading(false));
    }, [id, router]);

    return (
        <main className="min-h-screen pt-4 pb-20 px-3 sm:pt-6 sm:px-4 md:px-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-5">
                    <Link
                        href="/trips"
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft size={15} />
                        My Trips
                    </Link>
                </div>

                {isLoading && (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                        <div className="h-36 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                    </div>
                )}

                {!isLoading && error && (
                    <div className="text-center py-20">
                        <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                        <Link
                            href="/trips"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
                        >
                            <ArrowLeft size={14} />
                            Back to My Trips
                        </Link>
                    </div>
                )}

                {!isLoading && booking && (
                    booking.type === 'hotel'
                        ? <HotelDetail booking={booking} />
                        : <FlightDetail booking={booking} />
                )}
            </div>
        </main>
    );
}
