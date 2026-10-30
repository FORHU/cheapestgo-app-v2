'use client';

import { useTranslations } from 'next-intl';
import { SpecialRequestsForm, ShareBookingForm } from './booking-self-service';
import { DocumentLinks } from './travel-documents';

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import {
    ArrowLeft, Calendar, Users, CreditCard, Shield, CheckCircle, XCircle, SearchX,
} from 'lucide-react';
import { http } from '@/shared/lib/http';
import { fetchBooking as loadBooking } from '../lib/bookings-api';
import { formatCurrency } from '@/shared/lib/format';
import { BookingCard } from './booking-card';
import {
    ACTION, BookingCardSkeleton, DetailPanel, DetailRow, HAIRLINE, MUTED, TEXT, usePaidEstimate,
} from './booking-card-parts';
import { cn } from '@/shared/lib/cn';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import type { AnyBooking, HotelBooking, FlightBooking } from '@/shared/types';

import { CancellationModal } from '@/app/[locale]/trips/components/CancellationModal';
import { HotelCancelModal } from './hotel-cancel-modal';
import { nightsBetween } from '@/shared/lib/stay';

/**
 * A booking's own page, in the bookings list's materials: the card it was opened from at
 * its head — for a flight, with the itinerary already open — then the rest of the booking
 * as the results sidebar's panels. On a wide screen the money and the paperwork stand in a
 * column of their own beside the trip, where the price column stands on the card.
 */

// ─── Layout helpers ───────────────────────────────────────────────────────────

/**
 * The amount charged, and under it the same amount in the currency picked in the header —
 * the confirmation screen's two lines (`usePaidEstimate`). The second is left out until the
 * rates are live, and when the two currencies are the same.
 */
function TotalPaidRows({ amount, currency }: { amount: number; currency: string }) {
    const estimate = usePaidEstimate(amount, currency);
    return (
        <>
            <DetailRow label="Total Paid" value={<span className="text-[16px] font-bold">{formatCurrency(amount, currency)}</span>} />
            {estimate && <DetailRow label={estimate.label} value={estimate.amount} />}
        </>
    );
}

/** The cancel control: its own panel at the foot of the side column, and the softest red the page has. */
function CancelPanel({ label, onClick, note }: { label: string; onClick: () => void; note?: string }) {
    return (
        <section className="rounded-[20px] bg-white p-5 shadow-sm dark:bg-slate-900">
            <button
                type="button"
                onClick={onClick}
                className={cn(ACTION, 'w-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15')}
            >
                <XCircle size={15} aria-hidden />
                {label}
            </button>
            {note && <p className={cn('mt-2.5 text-center text-[12px]', MUTED)}>{note}</p>}
        </section>
    );
}

/** The two columns under the card: the trip on the left, the money and the paperwork on the right. */
function DetailColumns({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
    return (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">{main}</div>
            {/* Held in view beside a long stay page, under the navbar. */}
            <div className="space-y-5 lg:sticky lg:top-24">{side}</div>
        </div>
    );
}

function fmtDate(s: string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...opts });
}

// ─── Hotel Detail ─────────────────────────────────────────────────────────────

function HotelDetail({ booking }: { booking: HotelBooking }) {
    const tAll = useTranslations();
    const [cancelOpen, setCancelOpen] = useState(false);
    /** The booking's status once cancelled from here, as the API names it. */
    const [cancelledStatus, setCancelledStatus] = useState<string | null>(null);

    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = nightsBetween(checkIn, checkOut) ?? 1;
    const policy = booking.cancellation_policy;
    const refundable = policy?.refundableTag === 'RFN';
    const freeCancelDeadline = policy?.cancelPolicyInfos?.[0]?.cancelTime;

    // A booking cancelled whose refund failed can be cancelled again: that retries the money.
    const canCancel = !cancelledStatus && !!booking.booking_id
        && ['confirmed', 'pending', 'cancelled_refund_failed'].includes(booking.status);

    return (
        <div className="space-y-5">
            {/* The card, showing the status this page has since moved it to. */}
            <BookingCard
                booking={{ ...booking, status: (cancelledStatus ?? booking.status) as HotelBooking['status'] }}
                detail
            />

            <DetailColumns
                main={
                    <>
                        <DetailPanel title={tAll('trips.sections.stayDetails')} icon={Calendar}>
                            <DetailRow label="Check-in" value={fmtDate(booking.check_in)} />
                            <DetailRow label="Check-out" value={fmtDate(booking.check_out)} />
                            <DetailRow label="Duration" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
                            {booking.room_name && <DetailRow label="Room" value={booking.room_name} />}
                            <DetailRow
                                label="Guests"
                                value={`${booking.guests_adults} adult${booking.guests_adults !== 1 ? 's' : ''}${booking.guests_children > 0 ? `, ${booking.guests_children} child${booking.guests_children !== 1 ? 'ren' : ''}` : ''}`}
                            />
                            {booking.special_requests && <DetailRow label="Special Requests" value={booking.special_requests} />}
                        </DetailPanel>

                        {(booking.holder_first_name || booking.holder_email) && (
                            <DetailPanel title={tAll('trips.sections.guestInformation')} icon={Users}>
                                {(booking.holder_first_name || booking.holder_last_name) && (
                                    <DetailRow label="Name" value={`${booking.holder_first_name ?? ''} ${booking.holder_last_name ?? ''}`.trim()} />
                                )}
                                {booking.holder_email && <DetailRow label="Email" value={booking.holder_email} />}
                            </DetailPanel>
                        )}

                        <DetailPanel title={tAll('trips.sections.cancellationPolicy')} icon={Shield}>
                            <div className="py-2">
                                <div className={cn(
                                    'mb-3 flex items-center gap-2 rounded-xl p-3',
                                    refundable ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10',
                                )}>
                                    {refundable
                                        ? <CheckCircle size={16} className="shrink-0 text-emerald-600" />
                                        : <XCircle size={16} className="shrink-0 text-red-500" />}
                                    <span className={cn('text-[14px] font-semibold', refundable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                                        {refundable ? 'Free cancellation available' : 'Non-refundable'}
                                    </span>
                                </div>
                                {freeCancelDeadline && (
                                    <p className={cn('text-[13px]', MUTED)}>
                                        Free cancellation until{' '}
                                        <span className={cn('font-semibold', TEXT)}>
                                            {fmtDate(freeCancelDeadline, { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </p>
                                )}
                                {policy?.cancelPolicyInfos?.map((p, i) => (
                                    <div key={i} className={cn('mt-2 text-[13px]', MUTED)}>
                                        After {fmtDate(p.cancelTime)}: penalty of {formatCurrency(p.amount, p.currency ?? booking.currency)}
                                    </div>
                                ))}
                                {policy?.hotelRemarks?.map((r, i) => (
                                    <p key={i} className={cn('mt-1.5 text-[13px] italic', MUTED)}>{r}</p>
                                ))}
                                {!policy && <p className={cn('text-[13px]', MUTED)}>{tAll('trips.labels.policyNotAvailable')}</p>}
                            </div>
                        </DetailPanel>

                        <SpecialRequestsForm booking={booking} />
                        <ShareBookingForm bookingId={booking.id} defaultEmail={booking.holder_email} />
                    </>
                }
                side={
                    <>
                        <DetailPanel title={tAll('trips.sections.payment')} icon={CreditCard}>
                            <TotalPaidRows amount={booking.total_price} currency={booking.currency} />
                            <DetailRow label="Payment Method" value="Card (Stripe)" />
                            <DetailRow label="Booked On" value={fmtDate(booking.created_at)} />
                        </DetailPanel>

                        <DocumentLinks booking={booking} />

                        {canCancel && (
                            <CancelPanel
                                label={booking.status === 'cancelled_refund_failed' ? tAll('trips.bookingCard.actions.retryRefund') : 'Cancel Booking'}
                                onClick={() => setCancelOpen(true)}
                            />
                        )}
                        {cancelledStatus && (
                            <div className="flex items-center gap-2 rounded-[20px] bg-emerald-50 p-4 text-[14px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <CheckCircle size={16} aria-hidden />
                                {tAll('trips.flightBookingCard.successBanners.cancelled')}
                            </div>
                        )}
                    </>
                }
            />

            {cancelOpen && booking.booking_id && (
                <HotelCancelModal
                    reference={booking.booking_id}
                    propertyName={booking.property_name}
                    onClose={() => setCancelOpen(false)}
                    onDone={(result) => setCancelledStatus(result.status)}
                />
            )}
        </div>
    );
}

// ─── Flight Detail ────────────────────────────────────────────────────────────

interface FlightDetailProps {
    booking: FlightBooking;
    onSuccess: () => void;
}

function FlightDetail({ booking, onSuccess }: FlightDetailProps) {
    const tAll = useTranslations();
    const t = useTranslations('trips');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    const passengers = booking.passengers ?? [];

    const CANCELLABLE = new Set(['ticketed', 'booked', 'pnr_created', 'awaiting_ticket', 'cancel_failed']);
    const canCancel = CANCELLABLE.has(booking.status);

    return (
        <div className="space-y-5">
            {/* The card, its itinerary open: on this page that is the itinerary. */}
            <BookingCard booking={booking} detail />
            {(booking.flight_segments ?? []).length === 0 && (
                <p className={cn('px-1 text-[14px]', MUTED)}>{tAll('trips.noSegmentDetails')}</p>
            )}

            <DetailColumns
                main={passengers.length > 0 && (
                    <DetailPanel title={tAll('trips.sections.passengers')} icon={Users}>
                        {passengers.map((p, i) => (
                            <div key={i} className={cn('border-b py-3 last:border-0', HAIRLINE)}>
                                <p className={cn('text-[15px] font-medium', TEXT)}>
                                    {p.first_name} {p.last_name}
                                    {p.type && <span className={cn('ml-2 text-[13px] font-normal', MUTED)}>({p.type})</span>}
                                </p>
                                {p.ticket_number && (
                                    <p className="mt-0.5 font-mono text-[13px] text-emerald-600 dark:text-emerald-400">
                                        E-Ticket: {p.ticket_number}
                                    </p>
                                )}
                                {p.seat_number && (
                                    <p className={cn('mt-0.5 text-[13px]', MUTED)}>Seat {p.seat_number}</p>
                                )}
                            </div>
                        ))}
                    </DetailPanel>
                )}
                side={
                    <>
                        <DetailPanel title={tAll('trips.sections.payment')} icon={CreditCard}>
                            <TotalPaidRows amount={booking.charged_price ?? booking.total_price} currency={booking.currency} />
                            {booking.provider && <DetailRow label="Provider" value={<span className="capitalize">{booking.provider}</span>} />}
                            <DetailRow label="Booked On" value={fmtDate(booking.created_at)} />
                        </DetailPanel>

                        <DocumentLinks booking={booking} />

                        {canCancel && (
                            <CancelPanel
                                label={tAll('trips.cancellationModal.cancelBooking')}
                                onClick={() => setIsCancelModalOpen(true)}
                                note={t('v2.refundNotice')}
                            />
                        )}
                    </>
                }
            />

            <CancellationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                bookingId={booking.id}
                originalAmount={booking.charged_price ?? booking.total_price}
                currency={booking.currency}
                onSuccess={onSuccess}
            />
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BookingDetailProps {
    id: string;
}

export function BookingDetail({ id }: BookingDetailProps) {
    const tAll = useTranslations();
    const t = useTranslations('trips');
    const router = useRouter();
    const [booking, setBooking] = useState<AnyBooking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBooking = useCallback(() => {
        setIsLoading(true);
        // By row id or reference — the card links one, an email the other.
        loadBooking(http, id)
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

    useEffect(() => {
        fetchBooking();
    }, [fetchBooking]);

    // The reference to quote to support: ours for a stay, the airline's for a flight.
    const reference = booking?.type === 'hotel' ? booking.booking_id : booking?.pnr;

    return (
        // The bookings list's measure — the navbar's 1240px, padding inside — so the page
        // starts on the same line as the logo above it.
        <main className="flex-1 w-full max-w-[1240px] mx-auto px-6 pt-2 pb-24 md:pt-4 md:pb-28">
            <Link
                href="/trips"
                className={cn('inline-flex items-center gap-1.5 text-[14px] transition-colors hover:text-slate-900 dark:hover:text-white', MUTED)}
            >
                <ArrowLeft size={15} aria-hidden />
                {tAll('trips.myTrips')}
            </Link>

            {/* The list page's title and its line beneath, as "Flights to Seoul" sets them. */}
            <div className="mt-3 mb-5">
                <h1 className="text-lg font-bold text-slate-900 md:text-2xl dark:text-slate-50">{t('bookingDetails')}</h1>
                {reference && (
                    <p className="mt-0.5 text-xs text-slate-500 md:text-sm dark:text-white/55">
                        {t('pages.ref')} <span className="font-mono font-semibold tracking-wider">{reference}</span>
                    </p>
                )}
            </div>

            {isLoading && !booking && (
                <div className="space-y-5">
                    <BookingCardSkeleton />
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="h-48 animate-pulse rounded-[20px] bg-white shadow-sm dark:bg-slate-900" />
                        <div className="h-48 animate-pulse rounded-[20px] bg-white shadow-sm dark:bg-slate-900" />
                    </div>
                </div>
            )}

            {!isLoading && error && (
                <StateScreen
                    icon={SearchX}
                    title={error}
                    className="rounded-2xl"
                    actions={
                        <Link href="/trips" className={stateActionClass}>
                            {t('v2.backToMyTrips')}
                        </Link>
                    }
                />
            )}

            {booking && (
                booking.type === 'hotel'
                    ? <HotelDetail booking={booking} />
                    : <FlightDetail booking={booking} onSuccess={fetchBooking} />
            )}
        </main>
    );
}
