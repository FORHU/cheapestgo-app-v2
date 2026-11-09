'use client';

import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Luggage, BaggageClaim, Armchair, ChevronDown, ChevronUp, BadgeDollarSign } from 'lucide-react';
import type { FlightOffer } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import { SaveButton } from './SaveButton';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertForDisplay } from '@/shared/lib/currency';
import { useLiveRates } from '@/shared/lib/use-live-rates';
import { dayOffset, formatTime, groupSegmentsBySlice } from '../lib/flight-utils';
import type { OfferHighlight } from '../lib/filter-offers';
import { FlightItinerary } from './flight-itinerary';

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
 *
 * Exported for the trip cards, which draw a booked flight the way it was found.
 */
export function AirlineBadge({ code, name, className }: { code: string; name: string; className?: string }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const iata = (code ?? '').toUpperCase().slice(0, 3);
    const showLogo = !!iata && !failed;

    return (
        <span
            className={cn(
                'relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-[1.04] md:size-[120px] md:shadow-md',
                className,
            )}
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
 *
 * Without the plane it is the line a hotel stay's card draws between check-in
 * and check-out (`booking-card.tsx`) — same streak, nothing flying it.
 */
export function RouteLine({ stops, plane = true }: { stops: number; plane?: boolean }) {
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
            {plane && (
                <span className="route-flight absolute inset-0">
                    {/* The streak the plane leaves behind it. */}
                    <span className="absolute top-1/2 right-2 h-[2px] w-2/5 -translate-y-1/2 rounded-full bg-linear-to-r from-transparent to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <Plane
                        size={14}
                        className="absolute top-1/2 right-0 -translate-y-1/2 rotate-45 fill-current text-blue-600 drop-shadow-[0_0_4px_rgba(37,99,235,0.7)] dark:text-cyan-300 dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.9)]"
                    />
                </span>
            )}
        </span>
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
    /** Marked as the cheapest or the fastest of the results — on a phone, a badge by the airline. */
    highlight?: OfferHighlight;
}

/** The badge's colours: the cheapest in the refund line's green, the fastest in the brand's blue. */
const HIGHLIGHT_TONE: Record<OfferHighlight, string> = {
    cheapest: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    fastest:  'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
};

export function FlightCard({ offer, adults = 1, className, index = 0, onSelect, isSelected = false, checkingPrice = false, highlight }: FlightCardProps) {
    const tAll = useTranslations();
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);

    // Every price on the card in the currency the traveller picked. Until the rates are live
    // `convertForDisplay` hands the airline's figure back in the airline's currency, and that is
    // what is printed — `useLiveRates` redraws the card when they land.
    const userCurrency = useUserCurrency();
    useLiveRates();
    const money = (amount: number, from: string) => {
        const shown = convertForDisplay(amount, from, userCurrency);
        return formatPrice(shown.amount, shown.currency);
    };

    const segments = offer.segments ?? [];
    const slices = groupSegmentsBySlice(segments);

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
                ? `Refundable (est. fee: ${money(penalty, fp?.refundPenaltyCurrency ?? 'USD')})`
                : 'Refundable (fees may apply)';
    const cabin = (primary.cabinClass || 'economy').replace('_', ' ');
    const checkedBags = offer.baggage?.checkedBags ?? 0;
    // The bags in one chip on a phone, where the desktop gives each its own line with an icon.
    const bagsLine = offer.baggage && [
        offer.baggage.cabinBag != null ? (offer.baggage.cabinBag ? '1 carry-on' : 'No carry-on') : null,
        checkedBags > 0 ? `${checkedBags} checked` : 'No checked bag',
    ].filter(Boolean).join(' · ');

    // One card, two layouts. On a phone (below `md`) it is a grid: the airline, its badge and the
    // bookmark on one line, then the times, the fare's chips, and the price over a rule. From `md`
    // up it is the desktop's three columns — logo plate, itinerary, price — and the grid's cells
    // are those columns' own children: the wrappers that make the columns are `display: contents`
    // on a phone, so nothing is drawn twice. `max-md:` styles are the phone's alone.
    const fact = 'inline-flex items-center gap-1 whitespace-nowrap md:gap-1.5';
    const chip = 'max-md:rounded-full max-md:bg-slate-100 max-md:px-2.5 max-md:py-1 max-md:dark:bg-white/8';
    const chipText = 'max-md:text-slate-600 max-md:dark:text-slate-300';
    const factIcon = 'size-3 md:size-[15px]';
    const time = cn('text-[20px] leading-none font-semibold tracking-[-0.01em] md:text-[30px]', TITLE);
    const code = cn('mt-1 text-[11px] tracking-[0.04em] md:mt-1.5 md:text-[14px]', MUTED);

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
            className={cn(
                'group relative w-full overflow-hidden rounded-2xl transition-shadow duration-150',
                // A hairline round the card on a phone, as the design draws it.
                'max-md:border max-md:border-slate-200 max-md:dark:border-white/10',
                SURFACE,
                isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-lg dark:hover:shadow-black/40',
                className,
            )}
        >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 px-4 pt-3.5 pb-3 md:flex md:min-h-[205px] md:flex-row md:items-stretch md:gap-0 md:p-0">
                {/* ─── Logo plate ─── */}
                {/* No fill of its own: the disc sits straight on the card. On a phone, a small
                    disc at the head of the airline's line. */}
                <div className="col-start-1 row-start-1 md:relative md:flex md:w-[240px] md:shrink-0 md:items-center md:justify-center md:px-6">
                    <AirlineBadge code={primary.airline} name={primary.airlineName || primary.airline} className="size-8" />
                </div>

                {/* ─── Itinerary ─── */}
                <div className="contents md:flex md:min-w-0 md:flex-1 md:flex-col md:pt-7 md:pr-8 md:pb-6 md:pl-9">
                    <div className="col-start-2 row-start-1 min-w-0">
                        <h3 className={cn('text-[15px] leading-tight font-bold max-md:truncate md:text-[20px]', TITLE)}>{primary.airlineName || primary.airline}</h3>
                        <p className={cn('mt-0.5 text-[11px] max-md:truncate md:mt-1 md:text-[13px]', MUTED)}>
                            {primary.flightNumber}
                            {segments.length > 1 && ` + ${segments.length - 1} more`}
                        </p>
                    </div>

                    <div className="col-span-full row-start-2 mt-3 flex items-center gap-3 md:mt-[18px] md:gap-5">
                        <div>
                            <div className={time}>{formatTime(primary.departure?.time)}</div>
                            <div className={code}>{primary.origin}</div>
                        </div>
                        {/* The route line keeps its plane, on a phone as on the desktop. */}
                        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 md:gap-1.5">
                            <span className={cn('text-[11px] md:text-[13px]', TEXT)}>{formatDuration(outboundMinutes)}</span>
                            <RouteLine stops={outboundStops} />
                            <span className={cn('text-[12px] md:text-[13px]', MUTED)}>{stopsLabel(outboundStops)}</span>
                        </div>
                        <div className="text-right">
                            <div className={time}>
                                {formatTime(last.arrival?.time)}
                                {arrivalDays > 0 && <sup className={cn('ml-0.5 text-[11px] font-medium md:text-[12px]', MUTED)}>+{arrivalDays}</sup>}
                            </div>
                            <div className={code}>{last.destination}</div>
                        </div>
                    </div>

                    {/* The fare's facts: on a phone, the refund terms and the bags as two chips; on the
                        desktop, all of them in a line with their icons. */}
                    <div className={cn('col-span-full row-start-3 mt-3 flex flex-wrap items-center gap-1.5 text-[12px] md:mt-[18px] md:gap-x-[18px] md:gap-y-1.5 md:text-[14px]', MUTED)}>
                        <span className={cn(fact, chip, isRefundable ? 'text-emerald-600 dark:text-emerald-400' : chipText)}>{refundLabel}</span>
                        <span className={cn(fact, 'capitalize max-md:hidden')}><Armchair size={15} className={factIcon} />{cabin}</span>
                        {primary.aircraft && <span className={cn(fact, 'max-md:hidden')}><Plane size={15} className={factIcon} />{primary.aircraft}</span>}
                        {offer.baggage?.cabinBag != null && (
                            <span className={cn(fact, 'max-md:hidden')}>
                                <Luggage size={15} className={factIcon} />
                                {offer.baggage.cabinBag ? '1 carry-on bag' : 'No carry-on bag'}
                            </span>
                        )}
                        {offer.baggage && (
                            <span className={cn(fact, 'max-md:hidden')}>
                                <BaggageClaim size={15} className={factIcon} />
                                {checkedBags > 0 ? `${checkedBags} checked bag${checkedBags > 1 ? 's' : ''}` : 'No checked bag'}
                            </span>
                        )}
                        {bagsLine && <span className={cn(fact, chip, chipText, 'md:hidden')}>{bagsLine}</span>}
                    </div>

                    {/* On a phone, "Flight details" under the price opens the same panel. */}
                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        aria-expanded={expanded}
                        className={cn('mt-3 hidden items-center gap-1 self-start text-[14px] transition-opacity hover:opacity-70 md:inline-flex', TEXT)}
                    >
                        {expanded
                            ? 'Hide segments'
                            : offer.alternatives && offer.alternatives.length > 0
                                ? `Show segments · ${offer.alternatives.length + 1} fare options`
                                : 'Show segments'}
                        {expanded ? <ChevronUp size={15} className={factIcon} /> : <ChevronDown size={15} className={factIcon} />}
                    </button>
                </div>

                {/* ─── Badge ─── */}
                {/* The phone's alone: the desktop card has no place for it yet. */}
                {highlight && (
                    <span
                        className={cn(
                            'col-start-3 row-start-1 rounded-md border px-2 py-[3px] text-[10px] leading-none font-bold tracking-[0.08em] uppercase md:hidden',
                            HIGHLIGHT_TONE[highlight],
                        )}
                    >
                        {tAll(`flights.filters.${highlight}`)}
                    </span>
                )}

                {/* ─── Price ─── */}
                <div className={cn('contents md:flex md:w-[230px] md:shrink-0 md:flex-col md:items-stretch md:justify-between md:gap-3 md:border-l md:p-6', HAIRLINE)}>
                    <div className="col-start-4 row-start-1 flex justify-end">
                        {/* A bare icon on a phone, still 36px to tap; the gradient disc from `md` up. */}
                        <SaveButton
                            {...saveProps}
                            variant="bookmark"
                            className="max-md:-mr-2 max-md:bg-none max-md:text-slate-400 max-md:hover:text-slate-600 max-md:dark:text-white/60 max-md:dark:hover:text-white"
                        />
                    </div>
                    <div className={cn('col-span-full row-start-4 mt-3 flex items-center justify-between gap-3 border-t pt-3 md:contents', HAIRLINE)}>
                        <div className="min-w-0">
                            <p className="whitespace-nowrap">
                                <span className={cn('text-[20px] font-bold max-md:leading-tight md:text-[26px]', TITLE)}>{money(pricePerPerson, currency)}</span>
                                <span className={cn('text-[15px] max-md:hidden', MUTED)}> / person</span>
                            </p>
                            <p className={cn('mt-1 text-[13px] first-letter:uppercase max-md:hidden', MUTED)}>{tAll('flights.card.includesTaxes')}</p>
                            <button
                                type="button"
                                onClick={() => setExpanded(!expanded)}
                                aria-expanded={expanded}
                                className="mt-0.5 text-[12px] font-medium text-blue-600 transition-opacity hover:opacity-75 md:hidden dark:text-blue-400"
                            >
                                {tAll('flights.card.flightDetails')}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleSelect(offer)}
                            disabled={checkingPrice}
                            className={cn(
                                'h-11 shrink-0 rounded-xl px-6 text-[14px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-60',
                                'md:h-[42px] md:w-full md:rounded-full md:text-[15px] md:font-medium',
                                CHIP,
                            )}
                        >
                            {checkingPrice ? 'Checking price…' : (
                                <>
                                    <span className="md:hidden">{tAll('flights.card.select')}</span>
                                    <span className="max-md:hidden">Select Now</span>
                                </>
                            )}
                        </button>
                    </div>
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
                                                {money(offer.price.total, offer.price.currency)}
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
                                                    {money(alt.price?.total ?? 0, alt.price?.currency ?? 'USD')}
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

                        {/* Across the whole card, under the plate as well — the airport names
                            and terminals need the width more than the plate needs the column. */}
                        <FlightItinerary offer={offer} className="px-5 pt-5 pb-6 md:px-9" />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}

export default FlightCard;
