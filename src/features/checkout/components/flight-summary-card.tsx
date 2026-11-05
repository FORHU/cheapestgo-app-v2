'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FlightOffer } from '@/shared/types';
import { FlightItinerary } from '@/features/flights/components/flight-itinerary';
import {
    airportLabel, cabinLabel, dayOffset, formatDuration, formatOfferDate, formatTime, groupSegmentsBySlice,
} from '@/features/flights/lib/flight-utils';
import { formatMoney } from '../lib/format-money';
import type { Palette } from '../lib/palette';

/** What the search link carried, shown until the offer itself has been read. */
export interface FlightSummaryFallback {
    origin: string;
    destination: string;
    departureDate?: string;
    cabin?: string;
}

interface FlightSummaryCardProps {
    offer: FlightOffer | null;
    fallback: FlightSummaryFallback;
    total: number;
    currency: string;
    palette: Palette;
}

/**
 * The flight being bought, as v1 showed it: the airline and flight, the outbound end to end,
 * what the fare includes, and the price — with the flight-by-flight itinerary a click away.
 *
 * The outbound alone is drawn on the card, as the results card draws it; a return is one
 * click away in the itinerary rather than repeated here.
 */
export function FlightSummaryCard({ offer, fallback, total, currency, palette }: FlightSummaryCardProps) {
    const t = useTranslations();
    const [open, setOpen] = useState(false);

    // "USD 297", not "USD 297.00": a whole-unit fare reads without the empty cents.
    const price = formatMoney(total, currency).replace(/\.0+$/, '');

    const slices = offer ? groupSegmentsBySlice(offer.segments ?? []) : [];
    const outbound = slices[0]?.segments ?? [];
    const first = outbound[0];
    const last = outbound[outbound.length - 1];

    const priceBlock = (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 }}>
            <span style={{ fontSize: 13, color: palette.muted }}>{t('checkout.flight.summary.totalPrice')}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: palette.title }}>{price}</span>
        </div>
    );

    const plate: React.CSSProperties = { background: palette.surface, borderRadius: 12, padding: '18px 30px 22px' };

    // The offer is not in hand (still loading, or it could not be read): what the link said.
    if (!offer || !first || !last) {
        return (
            <div style={plate}>
                <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>{`${fallback.origin} → ${fallback.destination}`}</div>
                {fallback.departureDate && (
                    <div style={{ fontSize: 13, color: palette.text, marginTop: 4 }}>{formatOfferDate(fallback.departureDate)}</div>
                )}
                {fallback.cabin && (
                    <div style={{ fontSize: 13, color: palette.soft, marginTop: 4 }}>{cabinLabel(fallback.cabin)}</div>
                )}
                <div aria-hidden style={{ height: 1, background: palette.cardLine, margin: '14px 0' }} />
                {priceBlock}
            </div>
        );
    }

    const stops = outbound.length - 1;
    // The provider's quoted figure; lacking one, only a one-way's offer total is the same number.
    const minutes = offer.sliceDurations?.[slices[0].index] ?? (slices.length === 1 ? offer.totalDuration : undefined);
    const arrivalDays = dayOffset(first.departure?.time, last.arrival?.time);

    const policy = offer.farePolicy;
    const refundable = policy ? policy.isRefundable : offer.refundable;
    const refundLabel = !refundable
        ? t('flights.card.nonRefundable')
        : policy?.refundPenaltyAmount === 0
            ? t('flights.card.freeCancellation')
            : t('checkout.flight.receipt.refundable');

    // Bags only when the fare says something about them: silence is not "no bag".
    const bag = offer.baggage;
    const facts = [
        bag?.cabinBag != null ? (bag.cabinBag ? t('checkout.flight.receipt.carryOnBag') : t('checkout.flight.summary.noCarryOnBag')) : null,
        bag ? ((bag.checkedBags ?? 0) > 0
            ? t('checkout.flight.receipt.checkedBagsCount', { count: bag.checkedBags ?? 0 })
            : t('checkout.flight.summary.noCheckedBag')) : null,
        refundLabel,
        cabinLabel(first.cabinClass),
    ].filter((fact): fact is string => !!fact);

    const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.faint };
    const clock: React.CSSProperties = { fontSize: 24, fontWeight: 600, lineHeight: 1.1, color: palette.title };
    const airport: React.CSSProperties = { fontSize: 13, color: palette.text, marginTop: 4 };

    return (
        <div style={plate}>
            <div style={{ fontWeight: 700, fontSize: 17, color: palette.title }}>{first.airlineName || first.airline}</div>
            <div style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>
                {outbound.map((seg) => seg.flightNumber).filter(Boolean).join(' · ')}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
                <div style={{ minWidth: 0 }}>
                    <div style={label}>{t('checkout.flight.summary.departing')}</div>
                    <div style={{ ...clock, marginTop: 6 }}>{formatTime(first.departure?.time)}</div>
                    <div style={airport}>{airportLabel(first.departure, first.origin)}</div>
                    {first.departure?.terminal && (
                        <div style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
                            {t('flights.itinerary.terminal', { terminal: first.departure.terminal })}
                        </div>
                    )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'center', fontSize: 12, color: palette.muted, paddingTop: 22 }}>
                    <div style={{ color: palette.text }}>{formatDuration(minutes)}</div>
                    <div>{stops === 0 ? t('flights.itinerary.nonstop') : t('flights.itinerary.stopCount', { count: stops })}</div>
                </div>
                <div style={{ minWidth: 0, textAlign: 'right' }}>
                    <div style={label}>{t('checkout.flight.summary.arrivingAt')}</div>
                    <div style={{ ...clock, marginTop: 6 }}>
                        {formatTime(last.arrival?.time)}
                        {arrivalDays > 0 && <sup style={{ marginLeft: 2, fontSize: 12, fontWeight: 500, color: palette.muted }}>+{arrivalDays}</sup>}
                    </div>
                    <div style={airport}>{airportLabel(last.arrival, last.destination)}</div>
                    {last.arrival?.terminal && (
                        <div style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
                            {t('flights.itinerary.terminal', { terminal: last.arrival.terminal })}
                        </div>
                    )}
                </div>
            </div>

            <ul
                aria-label={t('checkout.flight.summary.fareDetails')}
                style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: palette.soft }}
            >
                {facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>

            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14, padding: 0,
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: palette.icon,
                }}
            >
                {open ? t('checkout.flight.summary.hideItineraries') : t('checkout.flight.summary.showItineraries')}
                {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
            {open && <FlightItinerary offer={offer} className="mt-4" />}

            <div aria-hidden style={{ height: 1, background: palette.cardLine, margin: '14px 0' }} />
            {priceBlock}
        </div>
    );
}

export default FlightSummaryCard;
