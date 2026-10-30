'use client';

import React, { useState } from 'react';
import { useBrandName } from '@/shared/components/BrandProvider';
import { Link } from '@/i18n/navigation';
import { Plane, Download, Ticket, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { useTranslations } from 'next-intl';
import { formatBookingTime as formatTime } from '@/features/flights/lib/flight-utils';
import { AirlineBadge, RouteLine } from '@/features/flights/components/flight-card';
import { FlightItinerary } from '@/features/flights/components/flight-itinerary';
import { BOOKING_CLOCK, bookingItinerary, outboundSegments } from '@/features/trips/lib/booking-itinerary';
import {
    ACTION, BookingCardShell, BookingSpan, BookingStatusBadge, CHIP, MUTED, SOFT, TEXT, TITLE, usePaidEstimate,
} from '@/features/trips/components/booking-card-parts';
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

interface FlightBookingCardProps {
    booking: FlightBooking;
    index?: number;
    /**
     * The card at the head of the booking's own page: no link to the page it is on, and
     * the itinerary already open — on that page it is the itinerary section.
     */
    detail?: boolean;
}

/**
 * A booked flight, drawn as the flight results card it was chosen from: the airline's
 * disc on the plate, departure and arrival either side of the route line, the price
 * column — here the amount paid, the status, and what can be done with the booking —
 * and the same flight-by-flight itinerary, opened under the card.
 *
 * The summary describes the outbound alone, as the results card's does.
 */
export function FlightBookingCard({ booking, index = 0, detail = false }: FlightBookingCardProps) {
    const tAll = useTranslations();
    const tTrips = useTranslations('trips');
    const brand = useBrandName();
    const [showItinerary, setShowItinerary] = useState(detail);

    const outbound = outboundSegments(booking);
    const first = outbound[0];
    const last = outbound[outbound.length - 1];
    const origin = first?.origin ?? '—';
    const destination = last?.destination ?? '—';
    const airline = first?.airline || null;
    const departDate = first?.departure.time ? formatDate(new Date(first.departure.time), { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const tripTypeLabel = booking.trip_type === 'round-trip'
        ? tAll('trips.flightBookingCard.tripTypes.roundTrip')
        : booking.trip_type === 'multi-city'
            ? tAll('trips.flightBookingCard.tripTypes.multiCity')
            : tAll('trips.flightBookingCard.tripTypes.oneWay');
    const flightNumber = first?.flightNumber ?? '';
    const status = FLIGHT_STATUS_MAP[booking.status] ?? { label: booking.status, color: 'bg-slate-100 text-slate-600' };
    const paid = booking.charged_price ?? booking.total_price;
    const estimate = usePaidEstimate(paid, booking.currency);

    // formatBookingTime, not the flights one: these come out of a timestamptz column, where an
    // offer's times are Local Airport Time digits that must not meet a Date. No duration either:
    // each end is its own airport's clock, so the gap between them is not the time in the air.
    const stops = outbound.length - 1;
    const stopsText = stops <= 0
        ? tAll('trips.flightBookingCard.nonstop')
        : tAll(stops === 1 ? 'trips.flightBookingCard.stop' : 'trips.flightBookingCard.stops', { count: stops });

    const handleDownloadTicket = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toast.success('Downloading E-Ticket...');

        // Trigger download of mock e-ticket text
        const text = `${brand.toUpperCase()} FLIGHT E-TICKET\n\nPNR: ${booking.pnr || 'N/A'}\nRoute: ${origin} -> ${destination}\nDate: ${departDate}\nStatus: ${booking.status}\n\nThank you for booking with ${brand}!`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `eticket-${booking.pnr || 'flight'}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const fact = 'inline-flex items-center gap-1.5 whitespace-nowrap';

    return (
        <BookingCardShell
            index={index}
            plate={
                <div className="flex h-20 items-center justify-center px-6 md:absolute md:inset-0 md:h-auto">
                    {airline ? (
                        <AirlineBadge code={airline} name={airline} />
                    ) : (
                        <span className="flex size-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 md:size-[120px] md:shadow-md">
                            <Plane className="size-6 text-slate-400 md:size-10" aria-hidden />
                        </span>
                    )}
                </div>
            }
            status={<BookingStatusBadge label={status.label} color={status.color} />}
            price={formatCurrency(paid, booking.currency)}
            priceLabel={tAll('trips.flightBookingCard.totalPaid')}
            estimate={estimate}
            actions={
                <>
                    {!detail && (
                        <Link
                            href={`/trips/${booking.id}`}
                            aria-label={`${tAll('trips.viewDetails')}: ${origin} → ${destination}`}
                            className={cn(ACTION, CHIP)}
                        >
                            {tAll('trips.viewDetails')}
                        </Link>
                    )}
                    {booking.status === 'ticketed' && (
                        <button
                            type="button"
                            onClick={handleDownloadTicket}
                            title={tTrips('v2.downloadETicket')}
                            className={cn(ACTION, SOFT, TEXT)}
                        >
                            <Download size={15} aria-hidden />
                            {tAll('trips.eTicket')}
                        </button>
                    )}
                </>
            }
            expansion={showItinerary && (
                <FlightItinerary offer={bookingItinerary(booking)} clock={BOOKING_CLOCK} className="px-5 pt-5 pb-6 md:px-9" />
            )}
        >
            <h3 className={cn('text-[20px] leading-tight font-bold', TITLE)}>
                {origin} <span className="text-blue-500">→</span> {destination}
            </h3>
            <p className={cn('mt-1 text-[13px]', MUTED)}>
                {[departDate, flightNumber].filter(Boolean).join(' · ')}
            </p>

            <BookingSpan
                from={{ value: formatTime(first?.departure.time), label: origin }}
                to={{ value: formatTime(last?.arrival.time), label: destination }}
                above={stopsText}
                line={<RouteLine stops={stops} />}
            />

            <div className={cn('mt-[18px] flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[14px]', MUTED)}>
                <span className={fact}><ArrowRight size={15} aria-hidden />{tripTypeLabel}</span>
                {booking.pnr && (
                    <span className={fact}>
                        <Ticket size={15} aria-hidden />
                        {tAll('trips.pnr')}
                        <span className={cn('font-mono font-semibold tracking-wider', TEXT)}>{booking.pnr}</span>
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={() => setShowItinerary((v) => !v)}
                aria-expanded={showItinerary}
                className={cn('mt-3 inline-flex items-center gap-1 self-start text-[14px] transition-opacity hover:opacity-70', TEXT)}
            >
                {showItinerary
                    ? tAll('trips.flightBookingCard.hideFlightItinerary')
                    : tAll('trips.flightBookingCard.flightItinerary')}
                {showItinerary ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
            </button>
        </BookingCardShell>
    );
}
