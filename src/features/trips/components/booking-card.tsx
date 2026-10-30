'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { Link } from '@/i18n/navigation';
import { Building2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { nightsBetween } from '@/shared/lib/stay';
import { RouteLine } from '@/features/flights/components/flight-card';
import { FlightBookingCard } from '@/app/[locale]/trips/components/FlightBookingCard';
import {
    ACTION, BookingCardShell, BookingSpan, BookingStatusBadge, CHIP, MUTED, TITLE, usePaidEstimate,
} from './booking-card-parts';
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

// ─── Hotel Card ───────────────────────────────────────────────────────────────

/**
 * A booked stay, drawn as the hotel results card it was found on — the photo on the
 * plate — in the flight card's frame, so the two read as one list. Check-in and
 * check-out take the places a flight's departure and arrival do, with the nights
 * between them where a flight has its duration.
 */
function HotelCard({ booking, index, detail }: { booking: HotelBooking; index: number; detail: boolean }) {
    const tAll = useTranslations();
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = nightsBetween(checkIn, checkOut) ?? 1;
    const status = HOTEL_STATUS_MAP[booking.status] ?? { label: booking.status, color: 'bg-slate-100 text-slate-600' };
    const estimate = usePaidEstimate(booking.total_price, booking.currency);

    // The year only when it is not this one: "Nov 10" is enough to find a stay by, and
    // both ends of the line have to fit across a phone.
    const thisYear = new Date().getFullYear();
    const day = (d: Date) => formatDate(
        d,
        d.getFullYear() === thisYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
    );

    const adults = booking.guests_adults ?? 0;
    const children = booking.guests_children ?? 0;
    const guests = [
        adults > 0 ? tAll(adults === 1 ? 'trips.bookingCard.adult' : 'trips.bookingCard.adults', { count: adults }) : null,
        children > 0 ? tAll(children === 1 ? 'trips.bookingCard.child' : 'trips.bookingCard.children', { count: children }) : null,
    ].filter(Boolean).join(', ');

    return (
        <BookingCardShell
            index={index}
            plate={
                <div className="relative h-[160px] w-full overflow-hidden bg-slate-100 md:absolute md:inset-0 md:h-auto dark:bg-white/5">
                    {booking.property_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={booking.property_image}
                            alt={booking.property_name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Building2 size={30} className="text-slate-300 dark:text-white/25" aria-hidden />
                        </div>
                    )}
                </div>
            }
            status={<BookingStatusBadge label={status.label} color={status.color} />}
            price={formatCurrency(booking.total_price, booking.currency)}
            priceLabel={tAll('trips.bookingCard.totalPaid')}
            estimate={estimate}
            actions={!detail && (
                <Link
                    href={`/trips/${booking.id}`}
                    aria-label={`${tAll('trips.viewDetails')}: ${booking.property_name}`}
                    className={cn(ACTION, CHIP)}
                >
                    {tAll('trips.viewDetails')}
                </Link>
            )}
        >
            <h3 className={cn('truncate text-[20px] leading-tight font-bold', TITLE)}>{booking.property_name}</h3>
            {booking.room_name && (
                <p className={cn('mt-1 truncate text-[13px]', MUTED)}>{booking.room_name}</p>
            )}

            <BookingSpan
                from={{ value: day(checkIn), label: tAll('trips.labels.checkIn') }}
                to={{ value: day(checkOut), label: tAll('trips.labels.checkOut') }}
                above={tAll(nights === 1 ? 'trips.bookingCard.night' : 'trips.bookingCard.nights', { count: nights })}
                below={guests}
                line={<RouteLine stops={0} plane={false} />}
            />
        </BookingCardShell>
    );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * A booking as the list draws it — and, with `detail`, as the head of its own page: the
 * same card, without a link to the page it is already on.
 */
export function BookingCard({ booking, index = 0, detail = false }: { booking: AnyBooking; index?: number; detail?: boolean }) {
    if (booking.type === 'hotel') {
        return <HotelCard booking={booking} index={index} detail={detail} />;
    }
    return <FlightBookingCard booking={booking} index={index} detail={detail} />;
}
