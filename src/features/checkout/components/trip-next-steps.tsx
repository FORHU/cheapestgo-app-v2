'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, BedDouble, Flag, type LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { fetchGolfCatalogue } from '@/features/golf/api/golf.api';
import type { GolfCourse } from '@/features/golf/types';
import { ACCENT, type Palette } from '@/features/checkout/lib/palette';
import { hotelLink, teeTimeLink, type ArrivalStay } from '@/features/checkout/lib/trip-next-steps';

function NextCard({ href, icon: Icon, title, line, palette }: {
    href: string; icon: LucideIcon; title: string; line: string; palette: Palette;
}) {
    return (
        <Link
            href={href}
            className="cg-next-card"
            style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 16,
                background: palette.surface, border: `1.5px solid ${palette.summaryBorder}`,
                color: palette.title, textDecoration: 'none', transition: 'border-color .15s',
            }}
        >
            <span aria-hidden style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: palette.stepIdle,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT,
            }}>
                <Icon size={20} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{title}</span>
                <span style={{ display: 'block', fontSize: 14, color: palette.muted, marginTop: 2 }}>{line}</span>
            </span>
            <ArrowRight aria-hidden size={18} color={palette.faint} style={{ flexShrink: 0 }} />
        </Link>
    );
}

interface TripNextStepsProps {
    palette:         Palette;
    /** Where the flight lands and for how long, read off the offer. */
    stay:            ArrivalStay;
    adults:          number;
    childPassengers: number;
}

/**
 * The rest of the trip, offered once the flight is paid for: a hotel where it lands, for the stay
 * until the traveller flies on, and a tee time while they are there.
 *
 * The hotel needs nothing but the offer. The tee time needs the golf catalogue, asked for here;
 * until it answers, and when it cannot, the hotel is offered on its own rather than a golf card
 * that might lead nowhere.
 */
export function TripNextSteps({ palette, stay, adults, childPassengers }: TripNextStepsProps) {
    const t = useTranslations('checkout.flight.receipt.next');
    const locale = useLocale();
    const [courses, setCourses] = useState<GolfCourse[]>([]);

    useEffect(() => {
        let cancelled = false;
        fetchGolfCatalogue()
            .then((catalogue) => { if (!cancelled) setCourses(catalogue.courses); })
            .catch(() => { /* No golf card; the hotel stands alone. */ });
        return () => { cancelled = true; };
    }, []);

    const golf = teeTimeLink(courses, stay, adults);
    const dates = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
        .formatRange(new Date(`${stay.checkIn}T00:00:00Z`), new Date(`${stay.checkOut}T00:00:00Z`));

    return (
        <section className="no-print" aria-labelledby="trip-next-title" style={{ marginTop: 'clamp(32px,4vw,48px)' }}>
            <style>{`.cg-next-card:hover, .cg-next-card:focus-visible { border-color: ${ACCENT} !important; }`}</style>
            <h2 id="trip-next-title" style={{ fontSize: 20, fontWeight: 700, color: palette.title, margin: '0 0 14px' }}>
                {t('title')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <NextCard
                    href={hotelLink(stay, adults, childPassengers)}
                    icon={BedDouble}
                    title={t('hotel')}
                    line={t('hotelLine', { city: stay.city, dates })}
                    palette={palette}
                />
                {golf && (
                    <NextCard
                        href={golf.href}
                        icon={Flag}
                        title={t('teeTime')}
                        line={golf.city ? t('teeTimeLine', { city: golf.city }) : t('teeTimeAnywhere')}
                        palette={palette}
                    />
                )}
            </div>
        </section>
    );
}
