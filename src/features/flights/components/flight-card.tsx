'use client';

import { useLocale, useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Luggage, BaggageClaim, Armchair, ChevronDown, ChevronUp, BadgeDollarSign } from 'lucide-react';
import type { FlightOffer, NormalizedSegment, SegmentEnd } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import { SaveButton } from './SaveButton';
import { formatTime } from '../lib/flight-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────


function formatDuration(minutes?: number): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function stopsLabel(stops: number): string {
    if (stops === 0) return 'Nonstop';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
}

/**
 * Groups flat segments into the slices a traveller flies — outbound, return, each
 * leg of a multi-city trip — keyed by `segmentIndex`, which is also the index into
 * the offer's `sliceDurations`.
 */
function groupSegmentsIntoSlices(segments: NormalizedSegment[]): { index: number; segments: NormalizedSegment[] }[] {
    const map = new Map<number, NormalizedSegment[]>();
    for (const seg of segments) {
        const idx = seg.segmentIndex ?? 0;
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(seg);
    }
    return [...map.keys()].sort((a, b) => a - b).map((index) => ({ index, segments: map.get(index)! }));
}

/**
 * Whole calendar days between two Local Airport Times — the "+1" on a flight that
 * lands the day after it leaves. Dates only, so neither end's zone matters.
 */
function dayOffset(from?: string, to?: string): number {
    if (!from || !to) return 0;
    const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
    const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * "Wed, Oct 14, 2026, 18:40" — the day pinned to UTC before formatting so the
 * digits in the string survive, for the reason `formatTime` gives.
 */
function formatDateTime(iso: string | undefined, locale: string): string {
    if (!iso) return '';
    const day = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(day)) return '';
    const date = new Date(day).toLocaleDateString(locale, {
        timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
    return `${date}, ${formatTime(iso)}`;
}

/** "Hamad International Airport (DOH)", or the bare code when the provider named none. */
function airportLabel(end: SegmentEnd | undefined, fallbackCode: string): string {
    const code = end?.airport || fallbackCode;
    const name = end?.airportName;
    return name && name !== code ? `${name} (${code})` : code;
}

function cabinLabel(cabinClass?: string): string {
    return (cabinClass || 'economy').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Minutes on the ground between two legs.
 *
 * Both clocks are Local Airport Time at the same airport (see `formatTime`), so
 * their digits are compared as they stand — read as UTC, which no zone or DST
 * rule can shift — rather than handed to a `Date` to guess a zone for.
 */
function layoverMinutes(arrival?: string, departure?: string): number | null {
    if (!arrival || !departure) return null;
    const a = Date.parse(`${arrival.slice(0, 16)}Z`);
    const d = Date.parse(`${departure.slice(0, 16)}Z`);
    if (!Number.isFinite(a) || !Number.isFinite(d) || d <= a) return null;
    return Math.round((d - a) / 60_000);
}

// ─── Palette ──────────────────────────────────────────────────────────────────

/**
 * The hotel card's materials, so a flight and a stay look like one product.
 * Mirrors the constants at the top of `hotel-card.tsx`.
 */
const SURFACE  = 'bg-white dark:bg-slate-900';
const TITLE    = 'text-slate-900 dark:text-slate-50';
const TEXT     = 'text-slate-700 dark:text-slate-100';
const MUTED    = 'text-slate-500 dark:text-slate-400';
const HAIRLINE = 'border-slate-200 dark:border-white/10';
/** Select Now, and the stop marker on the route line: the brand gradient. */
const CHIP     = 'bg-linear-to-r from-blue-600 to-cyan-500 text-white';

// ─── Airline wordmark ─────────────────────────────────────────────────────────

/**
 * The card's plate: the airline's logo in a white disc.
 *
 * The disc is what lets a logo show in its own colours on either plate. Tinted
 * white to sit straight on the dark plate, a logo drawn on a solid shape (Scoot's)
 * came out as a white blob; untinted, a dark one had nothing to stand out against.
 * White is the ground every airline draws its mark for.
 *
 * The square edition from pics.avs.io — a wide mark centred in a transparent
 * square, so it sits across the disc's middle. The two-letter code holds the disc
 * until the image lands, and stays if it never does.
 */
function AirlineBadge({ code, name }: { code: string; name: string }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const iata = (code ?? '').toUpperCase().slice(0, 3);
    const showLogo = !!iata && !failed;

    return (
        <span
            className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-[1.04] md:size-[120px] md:shadow-md"
        >
            {showLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`https://pics.avs.io/200/200/${iata}.png`}
                    alt={name}
                    className={cn('size-full object-contain p-1 md:p-2', !loaded && 'invisible')}
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                />
            )}
            {(!showLogo || !loaded) && (
                <span aria-hidden={showLogo} className="absolute text-[13px] font-bold tracking-wide text-slate-700 md:text-[22px]">
                    {iata || name.slice(0, 2).toUpperCase()}
                </span>
            )}
        </span>
    );
}

// ─── Route line ───────────────────────────────────────────────────────────────

/**
 * The line between departure and arrival: a glowing streak of the brand
 * gradient, with a plane flying it towards the destination and a dot at the
 * midpoint for a connection.
 *
 * The track is taller than the line so the plane has room, and clipped so the
 * plane enters from behind the departure end rather than over the clock; its
 * negative margin keeps the card's rhythm what it was with a 1px rule. The
 * motion itself is `.route-flight` in globals.css: the plane waits at the
 * departure end and flies only while the card is hovered.
 */
function RouteLine({ stops }: { stops: number }) {
    return (
        <span aria-hidden className="relative -my-[7px] block h-4 w-full overflow-hidden">
            <span
                className={cn(
                    'absolute inset-x-0 top-1/2 h-px -translate-y-1/2',
                    'bg-linear-to-r from-blue-500/40 via-cyan-400/70 to-blue-500/40',
                    'shadow-[0_0_6px_rgba(37,99,235,0.35)] dark:shadow-[0_0_8px_rgba(34,211,238,0.55)]',
                )}
            />
            {stops > 0 && (
                <span className={cn('absolute top-1/2 left-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full', CHIP)} />
            )}
            <span className="route-flight absolute inset-0">
                {/* The streak the plane leaves behind it. */}
                <span className="absolute top-1/2 right-2 h-[2px] w-2/5 -translate-y-1/2 rounded-full bg-linear-to-r from-transparent to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <Plane
                    size={14}
                    className="absolute top-1/2 right-0 -translate-y-1/2 rotate-45 fill-current text-blue-600 drop-shadow-[0_0_4px_rgba(37,99,235,0.7)] dark:text-cyan-300 dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.9)]"
                />
            </span>
        </span>
    );
}

// ─── Itinerary (expanded view) ────────────────────────────────────────────────
// v1's flight-by-flight itinerary (`FlightItineraryTimeline`), in this card's
// materials: each flight as two ends either side of its duration, each end
// carrying what a traveller needs at that airport.

/**
 * A list of independent facts, one to a line. The departure's hang off bullets on
 * the left; the arrival mirrors it, flush right with its dot after the words. An
 * absent fact (no aircraft quoted) is left out rather than shown as an empty line.
 */
function FactList({ items, align }: { items: React.ReactNode[]; align: 'left' | 'right' }) {
    const shown = items.filter((item) => item !== undefined && item !== null && item !== '');
    if (shown.length === 0) return null;
    const right = align === 'right';

    return (
        <ul
            className={cn(
                'mt-1 flex flex-col gap-0.5 text-[12px] leading-snug md:text-[13px]',
                TEXT,
                right
                    ? 'list-none items-end text-right'
                    : 'list-disc items-start ps-[18px] text-left marker:text-slate-400 dark:marker:text-slate-500',
            )}
        >
            {shown.map((item, i) => (
                <li key={i} className={right ? 'flex items-center gap-1.5' : undefined}>
                    <span>{item}</span>
                    {/* A list marker cannot sit on the right, so the arrival's dot is drawn. */}
                    {right && <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />}
                </li>
            ))}
        </ul>
    );
}

/**
 * One end of a flight: the clock, the airport in full, then the date and time, the
 * terminal, the cabin and flight, the aircraft — under DEPART FROM or ARRIVE AT.
 */
function EndColumn({
    end, code, segment, departedAt, label, align,
}: {
    end: SegmentEnd | undefined;
    code: string;
    segment: NormalizedSegment;
    /** For the arrival end: when this flight left, for the "+1" on an overnight landing. */
    departedAt?: string;
    label: string;
    align: 'left' | 'right';
}) {
    const t = useTranslations('flights.itinerary');
    const locale = useLocale();
    const days = align === 'right' ? dayOffset(departedAt, end?.time) : 0;

    // Kept italic when the airline has not named one yet, so "we don't know" still
    // reads differently from a confirmed terminal.
    const terminal = end?.terminal
        ? t('terminal', { terminal: end.terminal })
        : <em>{t('terminalUnavailable')}</em>;

    return (
        <div className={cn('flex w-[38%] shrink-0 flex-col sm:w-[34%]', align === 'left' ? 'items-start text-left' : 'items-end text-right')}>
            <span className={cn('text-lg leading-none font-semibold tracking-[-0.01em] whitespace-nowrap md:text-2xl', TITLE)}>
                {formatTime(end?.time)}
                {days > 0 && <sup className={cn('ml-0.5 text-[12px] font-medium', MUTED)}>+{days}</sup>}
            </span>
            <span className={cn('mt-1.5 text-[12px] leading-snug md:text-[13px]', TEXT)}>{airportLabel(end, code)}</span>
            <span className={cn('mt-3 text-[11px] tracking-[0.13em] uppercase md:text-[12px]', MUTED)}>{label}</span>
            <FactList
                align={align}
                items={[
                    formatDateTime(end?.time, locale),
                    terminal,
                    `${cabinLabel(segment.cabinClass)} ${segment.flightNumber ?? ''}`.trim(),
                    segment.aircraft,
                ]}
            />
        </div>
    );
}

function LegRow({ segment }: { segment: NormalizedSegment }) {
    const t = useTranslations('flights.itinerary');
    const duration = formatDuration(segment.duration);

    return (
        <div className="flex items-start justify-between gap-2 md:gap-4">
            <EndColumn end={segment.departure} code={segment.origin} segment={segment} label={t('departFrom')} align="left" />
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 pt-1.5">
                {duration && (
                    <span className={cn('text-center text-[11px] md:text-[12px]', MUTED)}>
                        {t('flightDuration')} <span className={TEXT}>{duration}</span>
                    </span>
                )}
                <span className="w-full border-t border-dotted border-blue-500/70" />
            </div>
            <EndColumn
                end={segment.arrival}
                code={segment.destination}
                segment={segment}
                departedAt={segment.departure?.time}
                label={t('arriveAt')}
                align="right"
            />
        </div>
    );
}

/** The wait between two flights — a pill, because it is what a traveller scanning a connection most needs to see. */
function LayoverNote({ minutes, airport }: { minutes: number; airport: string }) {
    const t = useTranslations('flights.itinerary');
    return (
        <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-500/15 dark:text-amber-300">
                {t('layoverLabel')}
            </span>
            <span className={cn('text-[12px] md:text-[13px]', TEXT)}>
                {t('layoverValue', { duration: formatDuration(minutes), airport })}
            </span>
        </div>
    );
}

// ─── FlightCard ───────────────────────────────────────────────────────────────

export interface FlightCardProps {
    offer: FlightOffer;
    adults?: number;
    className?: string;
    index?: number;
    onSelect?: (offer: FlightOffer) => void;
    isSelected?: boolean;
    /** The fare is being checked with the airline before checkout — see handleSelect. */
    checkingPrice?: boolean;
}

export function FlightCard({ offer, adults = 1, className, index = 0, onSelect, isSelected = false, checkingPrice = false }: FlightCardProps) {
    const tAll = useTranslations();
    const tItin = useTranslations('flights.itinerary');
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);

    const segments = offer.segments ?? [];
    const slices = groupSegmentsIntoSlices(segments);

    // Primary metrics for the collapsed card view
    // The summary row describes the outbound alone, as v1's card does. Read across every
    // segment, a round trip went CRK → CRK, ran both directions' hours end to end, and
    // counted the return's stops as the outbound's.
    const outbound = slices[0]?.segments ?? [];
    const primary = outbound[0];
    const last = outbound[outbound.length - 1];

    if (!primary || !last) return null;

    const outboundStops = outbound.length - 1;
    // The provider's quoted figure. Lacking one, a one-way's offer total is the same
    // number; a round trip's is not, and subtracting the offset-less clocks would be off
    // by the zone gap, so it is left blank rather than wrong.
    const outboundMinutes = offer.sliceDurations?.[slices[0].index]
        ?? (slices.length === 1 ? offer.totalDuration : undefined);
    const arrivalDays = dayOffset(primary.departure?.time, last.arrival?.time);

    const priceTotal = offer.price?.total ?? 0;
    const currency = offer.price?.currency ?? 'USD';
    const pricePerPerson = offer.price?.pricePerAdult ?? (adults > 0 ? priceTotal / adults : priceTotal);

    const handleSelect = (selectedOffer: FlightOffer) => {
        if (onSelect) {
            onSelect(selectedOffer);
        } else {
            sessionStorage.setItem('selectedFlight', JSON.stringify(selectedOffer));
            router.push(`/flights/book?offerId=${encodeURIComponent(selectedOffer.offerId)}`);
        }
    };

    const saveProps = {
        type: 'flight' as const,
        title: `${primary.origin} → ${last.destination} · ${primary.departure?.time?.slice(0, 10) ?? ''}`,
        subtitle: `${primary.airlineName || primary.airline} · ${formatDuration(outboundMinutes)} · ${stopsLabel(outboundStops)}`,
        price: offer.price.total,
        currency: offer.price.currency,
        imageUrl: `https://pics.avs.io/40/40/${(primary.airline || '').toUpperCase()}.png`,
        deepLink: `/flights/search?origin=${primary.origin}&destination=${last.destination}&departure=${primary.departure?.time?.slice(0, 10) ?? ''}`,
        snapshot: { offerId: offer.offerId, provider: offer.provider },
    };

    // The fare's facts, in the design's order: refund terms, cabin, aircraft, bags.
    const fp = offer.farePolicy;
    const isRefundable = fp ? fp.isRefundable : offer.refundable;
    const penalty = fp?.refundPenaltyAmount;
    const refundLabel = !isRefundable
        ? tAll('flights.card.nonRefundable')
        : penalty === 0
            ? tAll('flights.card.freeCancellation')
            : penalty != null && penalty > 0
                ? `Refundable (est. fee: ${formatPrice(penalty, fp?.refundPenaltyCurrency ?? 'USD')})`
                : 'Refundable (fees may apply)';
    const cabin = (primary.cabinClass || 'economy').replace('_', ' ');
    const checkedBags = offer.baggage?.checkedBags ?? 0;
    const fact = 'inline-flex items-center gap-1.5 whitespace-nowrap';
    const time = cn('text-2xl leading-none font-semibold tracking-[-0.01em] md:text-[30px]', TITLE);
    const code = cn('mt-1.5 text-[14px] tracking-[0.04em]', MUTED);

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
            className={cn(
                'group relative w-full overflow-hidden rounded-2xl transition-shadow duration-150',
                SURFACE,
                isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-lg dark:hover:shadow-black/40',
                className,
            )}
        >
            <div className="flex flex-col md:min-h-[205px] md:flex-row">
                {/* ─── Logo plate ─── */}
                {/* No fill of its own: the disc sits straight on the card. */}
                <div className="relative flex h-20 shrink-0 items-center justify-center px-6 md:h-auto md:w-[240px]">
                    <AirlineBadge code={primary.airline} name={primary.airlineName || primary.airline} />
                    {/* The bookmark rides on the plate on a phone, where the price column is a row. */}
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 md:hidden">
                        <SaveButton {...saveProps} variant="bookmark" />
                    </div>
                </div>

                {/* ─── Itinerary ─── */}
                <div className="flex min-w-0 flex-1 flex-col px-5 py-5 md:pt-7 md:pr-8 md:pb-6 md:pl-9">
                    <h3 className={cn('text-[20px] leading-tight font-bold', TITLE)}>{primary.airlineName || primary.airline}</h3>
                    <p className={cn('mt-1 text-[13px]', MUTED)}>
                        {primary.flightNumber}
                        {segments.length > 1 && ` + ${segments.length - 1} more`}
                    </p>

                    <div className="mt-[18px] flex items-center gap-4 md:gap-5">
                        <div>
                            <div className={time}>{formatTime(primary.departure?.time)}</div>
                            <div className={code}>{primary.origin}</div>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                            <span className={cn('text-[13px]', TEXT)}>{formatDuration(outboundMinutes)}</span>
                            <RouteLine stops={outboundStops} />
                            <span className={cn('text-[13px]', MUTED)}>{stopsLabel(outboundStops)}</span>
                        </div>
                        <div className="text-right">
                            <div className={time}>
                                {formatTime(last.arrival?.time)}
                                {arrivalDays > 0 && <sup className={cn('ml-0.5 text-[12px] font-medium', MUTED)}>+{arrivalDays}</sup>}
                            </div>
                            <div className={code}>{last.destination}</div>
                        </div>
                    </div>

                    <div className={cn('mt-[18px] flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[14px]', MUTED)}>
                        <span className={cn(fact, isRefundable && 'text-emerald-600 dark:text-emerald-400')}>{refundLabel}</span>
                        <span className={cn(fact, 'capitalize')}><Armchair size={15} />{cabin}</span>
                        {primary.aircraft && <span className={fact}><Plane size={15} />{primary.aircraft}</span>}
                        {offer.baggage?.cabinBag != null && (
                            <span className={fact}>
                                <Luggage size={15} />
                                {offer.baggage.cabinBag ? '1 carry-on bag' : 'No carry-on bag'}
                            </span>
                        )}
                        {offer.baggage && (
                            <span className={fact}>
                                <BaggageClaim size={15} />
                                {checkedBags > 0 ? `${checkedBags} checked bag${checkedBags > 1 ? 's' : ''}` : 'No checked bag'}
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        aria-expanded={expanded}
                        className={cn('mt-3 inline-flex items-center gap-1 self-start text-[14px] transition-opacity hover:opacity-70', TEXT)}
                    >
                        {expanded
                            ? 'Hide segments'
                            : offer.alternatives && offer.alternatives.length > 0
                                ? `Show segments · ${offer.alternatives.length + 1} fare options`
                                : 'Show segments'}
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                </div>

                {/* ─── Price ─── */}
                <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4 md:w-[230px] md:flex-col md:items-stretch md:border-t-0 md:border-l md:p-6', HAIRLINE)}>
                    <div className="hidden justify-end md:flex">
                        <SaveButton {...saveProps} variant="bookmark" />
                    </div>
                    <div>
                        <p className="whitespace-nowrap">
                            <span className={cn('text-[22px] font-bold md:text-[26px]', TITLE)}>{formatPrice(pricePerPerson, currency)}</span>
                            <span className={cn('text-[15px]', MUTED)}> / person</span>
                        </p>
                        <p className={cn('mt-1 text-[13px] first-letter:uppercase', MUTED)}>{tAll('flights.card.includesTaxes')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSelect(offer)}
                        disabled={checkingPrice}
                        className={cn('h-[42px] shrink-0 rounded-full px-6 text-[15px] font-medium transition-opacity hover:opacity-85 disabled:opacity-60 md:w-full', CHIP)}
                    >
                        {checkingPrice ? 'Checking price…' : 'Select Now'}
                    </button>
                </div>
            </div>

            {/* ─── Expanded View ── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className={cn('overflow-hidden border-t', HAIRLINE)}
                    >
                        {/* Alternatives / Brands Section */}
                        {offer.alternatives && offer.alternatives.length > 0 && (
                            <div className={cn('border-b px-5 py-4 md:px-9', HAIRLINE)}>
                                <h4 className={cn('mb-3 flex items-center gap-1.5 text-[12px] tracking-[0.13em] uppercase', MUTED)}>
                                    <BadgeDollarSign size={14} />
                                    {tAll('flights.card.fareOptions')}
                                </h4>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                                    {/* Current main offer as one of the options */}
                                    <div className="flex flex-col rounded-xl border border-blue-500 p-3">
                                        <div className="mb-1 flex items-start justify-between gap-2">
                                            <span className={cn('text-[12px] uppercase', TEXT)}>
                                                {offer.brandedFare?.brandName || offer.brandedFare?.fareType || 'Standard'}
                                            </span>
                                            <span className={cn('text-[13px] font-semibold', TITLE)}>
                                                {formatPrice(offer.price.total, offer.price.currency)}
                                            </span>
                                        </div>
                                        <p className={cn('mb-2 text-[12px] capitalize', MUTED)}>
                                            {(primary.cabinClass || 'economy').replace('_', ' ')} · Best Value
                                        </p>
                                        <button
                                            type="button"
                                            disabled
                                            className={cn('mt-auto h-8 cursor-default rounded-full text-[12px] opacity-50', CHIP)}
                                        >
                                            {tAll('flights.card.currentlySelected')}
                                        </button>
                                    </div>

                                    {/* Alternatives */}
                                    {offer.alternatives.map((alt) => (
                                        <div key={alt.offerId} className={cn('flex flex-col rounded-xl border p-3', HAIRLINE)}>
                                            <div className="mb-1 flex items-start justify-between gap-2">
                                                <span className={cn('text-[12px] uppercase', TEXT)}>
                                                    {alt.brandedFare?.brandName || alt.brandedFare?.fareType || 'Option'}
                                                </span>
                                                <span className={cn('text-[13px] font-semibold', TITLE)}>
                                                    {formatPrice(alt.price?.total ?? 0, alt.price?.currency ?? 'USD')}
                                                </span>
                                            </div>
                                            <p className={cn('mb-2 text-[12px] capitalize', MUTED)}>
                                                {(alt.segments[0]?.cabinClass || 'economy').replace('_', ' ')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(alt);
                                                }}
                                                className={cn(
                                                    'mt-auto h-8 rounded-full text-[12px] transition-colors hover:bg-linear-to-r hover:from-blue-600 hover:to-cyan-500 hover:text-white',
                                                    'bg-slate-100 dark:bg-white/8',
                                                    TEXT,
                                                )}
                                            >
                                                Select {alt.brandedFare?.brandName || alt.brandedFare?.fareType || 'this fare'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Flight by flight, each direction under its own name and run time.
                            Across the whole card, under the plate as well — the airport names
                            and terminals need the width more than the plate needs the column. */}
                        <div className="flex flex-col gap-7 px-5 pt-5 pb-6 md:px-9">
                            {slices.map(({ index, segments: sliceSegs }, i) => {
                                // "Outbound" only means something beside a return, so a
                                // single leg goes unnamed — the card above already says it.
                                const label = slices.length === 2
                                    ? tItin(i === 0 ? 'outbound' : 'return')
                                    : tItin('legLabel', { number: i + 1 });
                                // The provider's own figure for this direction, never the
                                // offer-wide total: an outbound and a return rarely match.
                                const total = offer.sliceDurations?.[index];

                                return (
                                    <div key={index} className="flex flex-col gap-5">
                                        {slices.length > 1 && (
                                            <div className="flex flex-wrap items-baseline gap-x-3 text-[12px]">
                                                <span className={cn('tracking-[0.13em] uppercase', MUTED)}>{label}</span>
                                                {total != null && total > 0 && (
                                                    <span className={MUTED}>
                                                        {tItin('totalFlightDuration')} <span className={TEXT}>{formatDuration(total)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {sliceSegs.map((seg, j) => {
                                            const prev = sliceSegs[j - 1];
                                            const lay = prev ? layoverMinutes(prev.arrival?.time, seg.departure?.time) : null;
                                            return (
                                                <React.Fragment key={`${index}-${j}`}>
                                                    {lay != null && (
                                                        <LayoverNote minutes={lay} airport={seg.departure?.airportName || seg.origin} />
                                                    )}
                                                    <LegRow segment={seg} />
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}

export default FlightCard;
