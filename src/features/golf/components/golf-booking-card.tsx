'use client';

import { Flag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/lib/cn';
import { RouteLine } from '@/features/flights/components/flight-card';
import {
    ACTION, BookingCardShell, BookingSpan, BookingStatusBadge, CHIP, MUTED, TITLE, usePaidEstimate,
} from '@/features/trips/components/booking-card-parts';
import { money, teeTimeLabels } from '@/features/golf/lib/format';
import type { GolfBooking, GolfBookingStatus } from '@/features/golf/types';

const STATUS_COLOR: Partial<Record<GolfBookingStatus, string>> = {
    requested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    declined:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',
};

/**
 * A golf booking in My Bookings, in the frame hotels and flights are drawn in: the course's photo on
 * the plate, the day and the tee time where a stay has its check-in and check-out. Cancelling lives on
 * the booking's own page, which this links to, so its one rule is not copied here.
 */
export function GolfBookingCard({ booking: b, index = 0 }: { booking: GolfBooking; index?: number }) {
    const t = useTranslations('trips.golfCard');
    const tGolf = useTranslations('golf');
    const locale = useLocale();

    // On the course's clock, which is the one it will be played on. The year only when it is not this
    // one, as the stay card has it.
    const tz = b.course.timezone ?? 'UTC';
    const at = new Date(b.startsAt);
    const sameYear = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: tz }).format(at) === String(new Date().getFullYear());
    const day = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
        day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: tz,
    }).format(at);
    const { time } = teeTimeLabels(b.startsAt, b.course.timezone, locale);

    // Nothing was taken for a declined booking or a cancelled request; a refund says what went back.
    const charged = b.status === 'confirmed';
    const estimate = usePaidEstimate(b.total, b.currency);
    const priceLabel = charged ? t('totalPaid')
        : b.status === 'requested' ? t('chargedOnConfirmation')
            : b.refundAmount > 0 ? t('refunded', { amount: money(b.refundAmount, b.currency, locale) })
                : t('notCharged');

    return (
        <BookingCardShell
            index={index}
            plate={
                <div className="relative h-[160px] w-full overflow-hidden bg-slate-100 md:absolute md:inset-0 md:h-auto dark:bg-white/5">
                    {b.course.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin URLs come from any host
                        <img
                            src={b.course.imageUrl}
                            alt={b.course.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Flag size={30} className="text-slate-300 dark:text-white/25" aria-hidden />
                        </div>
                    )}
                </div>
            }
            status={<BookingStatusBadge label={t(`status.${b.status}`)} color={STATUS_COLOR[b.status] ?? STATUS_COLOR.cancelled!} />}
            price={money(b.total, b.currency, locale)}
            priceLabel={priceLabel}
            estimate={charged || b.status === 'requested' ? estimate : null}
            actions={
                <Link
                    href={`/golf/bookings/${b.reference}`}
                    aria-label={`${t('view')}: ${b.course.name}`}
                    className={cn(ACTION, CHIP)}
                >
                    {t('view')}
                </Link>
            }
        >
            <h3 className={cn('truncate text-[20px] leading-tight font-bold', TITLE)}>{b.course.name}</h3>
            <p className={cn('mt-1 truncate text-[13px]', MUTED)}>{b.course.city} · {b.course.country}</p>

            <BookingSpan
                from={{ value: day, label: t('date') }}
                to={{ value: time, label: t('teeTime') }}
                above={tGolf('teeTimes.playerCount', { count: b.players })}
                below={b.reference}
                line={<RouteLine stops={0} plane={false} />}
            />
        </BookingCardShell>
    );
}
