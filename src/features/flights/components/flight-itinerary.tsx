'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import type { FlightOffer, NormalizedSegment, SegmentEnd } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import {
    cabinLabel, dayOffset, formatDuration, formatFlightDate, formatTime, groupSegmentsBySlice, layoverMinutes,
} from '../lib/flight-utils';

/*
 * The flight-by-flight itinerary, as a timeline: each direction under its route, date, stops
 * and cabin; then, down a rail, every stop's clock and airport, each flight between its two
 * stops, and the wait between two flights.
 *
 * It sits in places of very different widths — under a results card, in the checkout's summary
 * column, on a booking's page — so it reads the width it is given (a container query), not the
 * screen's. Narrow, the flight is a line between its stops; from 36rem wide (`@xl:`) it is a
 * box beside them and the heading carries the trip's totals.
 *
 * The rail is drawn in the brand's colours: the blue-to-cyan gradient of the results card's
 * route line for a flight, the brand blue dashed for a wait on the ground. Type is the site's.
 */

const TITLE    = 'text-slate-900 dark:text-slate-50';
const TEXT     = 'text-slate-700 dark:text-slate-100';
const MUTED    = 'text-slate-500 dark:text-slate-400';
const HAIRLINE = 'border-slate-200 dark:border-white/10';

/** A stop on the rail: a ring where a flight leaves, filled where it lands. */
const DOT = 'size-2.5 shrink-0 rounded-full mt-[5px] @xl:size-3 @xl:mt-1.5';
const DOT_DEPART = 'border-2 border-blue-600 dark:border-blue-400';
const DOT_ARRIVE = 'bg-blue-600 dark:bg-blue-400';
/** In the air: the brand gradient. */
const RAIL_FLYING = 'mt-[3px] w-0.5 flex-1 rounded-full bg-linear-to-b from-blue-600 to-cyan-500 @xl:mt-1 dark:from-blue-500 dark:to-cyan-400';
/** On the ground between two flights: the brand blue, dashed. */
const RAIL_WAITING = 'mt-[3px] w-0 flex-1 border-l-2 border-dashed border-blue-500/60 @xl:mt-1 dark:border-blue-400/60';

/**
 * How the itinerary reads its timestamps. An offer's are Local Airport Time, digits read as
 * written — `AIRPORT_CLOCK`, the default. A booking's come back from api-v2 in another form,
 * so the trips screens hand in their own readers (`BOOKING_CLOCK`) and keep this layout.
 */
export interface ItineraryClock {
    time: (iso?: string) => string;
    /** The day a direction leaves, for its heading: "Wed, Nov 25, 2026". */
    date: (iso: string | undefined, locale: string) => string;
    /** Whole days from a departure to its arrival — the "+1". */
    dayOffset: (from?: string, to?: string) => number;
    /** Minutes on the ground between a landing and the next take-off. */
    layover: (arrival?: string, departure?: string) => number | null;
}

export const AIRPORT_CLOCK: ItineraryClock = {
    time: formatTime,
    date: formatFlightDate,
    dayOffset,
    layover: layoverMinutes,
};

/** Where a stop is, for a heading: the city, else the airport's name, else its code. */
function placeName(end: SegmentEnd | undefined, code: string): string {
    return end?.city || end?.airportName || end?.airport || code;
}

/** The airline's mark, small: the code holds the disc when there is no logo. */
function AirlineMark({ code }: { code: string }) {
    const [failed, setFailed] = useState(false);
    const iata = (code || '').toUpperCase().slice(0, 3);
    return (
        <span aria-hidden className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5 @xl:size-7">
            {iata && !failed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://pics.avs.io/80/80/${iata}.png`} alt="" className="size-full object-contain p-px" onError={() => setFailed(true)} />
            ) : (
                <span className="text-[8px] font-bold text-slate-600 @xl:text-[10px]">{iata}</span>
            )}
        </span>
    );
}

/** A stop's clock, with the "+1" of a landing on a later day. */
function StopTime({ clock, at, days = 0 }: { clock: ItineraryClock; at?: string; days?: number }) {
    return (
        <span className={cn('col-start-1 text-[15px] leading-5 font-bold whitespace-nowrap @xl:text-[18px] @xl:leading-6', TITLE)}>
            {clock.time(at)}
            {days > 0 && <sup className={cn('ml-0.5 text-[11px] font-medium @xl:text-[12px]', MUTED)}>+{days}</sup>}
        </span>
    );
}

/** A stop: the city and code, then the airport and its terminal. */
function Stop({ end, code, className }: { end: SegmentEnd | undefined; code: string; className?: string }) {
    const t = useTranslations('flights.itinerary');
    const airportCode = end?.airport || code;
    const place = placeName(end, code);
    const heading = place !== airportCode ? `${place} (${airportCode})` : airportCode;
    const airport = end?.airportName && end.airportName !== place ? end.airportName : null;
    const terminal = end?.terminal ? t('terminal', { terminal: end.terminal }) : t('terminalTba');

    return (
        <div className={cn('col-start-3 min-w-0', className)}>
            <p className={cn('text-[14px] leading-5 font-semibold @xl:text-[15px] @xl:leading-6', TITLE)}>{heading}</p>
            <p className={cn('text-[12px] leading-snug @xl:text-[13px]', MUTED)}>{[airport, terminal].filter(Boolean).join(' · ')}</p>
        </div>
    );
}

/**
 * The flight between two stops: airline and number, aircraft and cabin, time in the air.
 * Narrow, a line on the rail between the stops; wide, a box beside them both.
 */
function Leg({ segment }: { segment: NormalizedSegment }) {
    const title = [segment.airlineName, segment.flightNumber].filter(Boolean).join(' · ') || segment.airline;
    const detail = [segment.aircraft, cabinLabel(segment.cabinClass)].filter(Boolean).join(' · ');
    const duration = formatDuration(segment.duration);

    return (
        <div
            className={cn(
                'col-start-3 flex items-center gap-2 pb-3.5',
                '@xl:col-start-4 @xl:row-span-2 @xl:mb-7 @xl:gap-3 @xl:self-center @xl:rounded-xl @xl:bg-slate-50 @xl:px-3.5 @xl:py-3 @xl:dark:bg-white/5',
            )}
        >
            <AirlineMark code={segment.airline} />
            <div className="min-w-0 flex-1">
                <p className={cn('text-[12px] leading-snug font-semibold @xl:text-[13px]', TEXT)}>{title}</p>
                {detail && <p className={cn('text-[12px] leading-snug', MUTED)}>{detail}</p>}
            </div>
            {duration && <span className={cn('shrink-0 text-[12px] whitespace-nowrap @xl:text-[13px]', TEXT)}>{duration}</span>}
        </div>
    );
}

/** The wait between two flights, and whether it means crossing to another airport. */
function Layover({ minutes, from, to }: { minutes: number; from: NormalizedSegment; to: NormalizedSegment }) {
    const t = useTranslations('flights.itinerary');
    const sameAirport = (from.arrival?.airport || from.destination) === (to.departure?.airport || to.origin);

    return (
        <div className="col-start-3 pb-3.5 @xl:col-span-2 @xl:pb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] leading-snug font-semibold text-amber-800 @xl:px-3 @xl:text-[13px] dark:bg-amber-500/15 dark:text-amber-300">
                <Clock className="size-3 shrink-0 @xl:size-[13px]" aria-hidden />
                <span>
                    {t('layoverIn', { duration: formatDuration(minutes), place: placeName(to.departure, to.origin) })}
                    {sameAirport
                        ? <span className="hidden @xl:inline"> · {t('sameAirport')}</span>
                        : <> · {t('changeAirports', { from: from.destination, to: to.origin })}</>}
                </span>
            </span>
        </div>
    );
}

/** Flight by flight, each direction under its route, day, stops and cabin. */
export function FlightItinerary({ offer, className, clock = AIRPORT_CLOCK }: {
    /** An offer, or anything shaped like its flights — a booking's, through `bookingItinerary`. */
    offer: Pick<FlightOffer, 'segments' | 'sliceDurations'>;
    className?: string;
    clock?: ItineraryClock;
}) {
    const t = useTranslations('flights.itinerary');
    const locale = useLocale();
    const slices = groupSegmentsBySlice(offer.segments ?? []);
    const terminalsPending = slices.some(({ segments }) =>
        segments.some((s) => !s.departure?.terminal || !s.arrival?.terminal));

    return (
        <div className={cn('@container', className)}>
            <div className="flex flex-col gap-8">
                {slices.map(({ index, segments }, i) => {
                    const first = segments[0];
                    const last = segments[segments.length - 1];
                    if (!first || !last) return null;

                    // "Outbound" only means something beside a return, so a single
                    // direction goes unnamed — the card above already says where it goes.
                    const label = slices.length === 2
                        ? t(i === 0 ? 'outbound' : 'return')
                        : t('legLabel', { number: i + 1 });
                    const stops = segments.length - 1;
                    const stopsText = stops === 0
                        ? t('nonstop')
                        : stops === 1
                            ? t('oneStopIn', { place: placeName(first.arrival, first.destination) })
                            : t('stopCount', { count: stops });
                    // The provider's own figure for this direction, never the offer-wide total.
                    const total = offer.sliceDurations?.[index];
                    const waiting = segments.slice(1).reduce((sum, seg, k) =>
                        sum + (clock.layover(segments[k].arrival?.time, seg.departure?.time) ?? 0), 0);

                    return (
                        <section key={index}>
                            <div className="flex items-start justify-between gap-3 @xl:items-end @xl:gap-6">
                                <div className="min-w-0">
                                    {slices.length > 1 && (
                                        <p className={cn('mb-1 text-[11px] tracking-[0.13em] uppercase', MUTED)}>{label}</p>
                                    )}
                                    <h4 className={cn('text-[17px] leading-tight font-bold tracking-[-0.01em] @xl:text-[20px]', TITLE)}>
                                        {placeName(first.departure, first.origin)} → {placeName(last.arrival, last.destination)}
                                    </h4>
                                    <p className={cn('mt-1 text-[12px] @xl:text-[13px]', MUTED)}>
                                        {[clock.date(first.departure?.time, locale), stopsText, cabinLabel(first.cabinClass)].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <dl className="flex shrink-0 gap-7 text-right @xl:text-left">
                                    {total != null && total > 0 && (
                                        <div>
                                            <dt className={cn('sr-only text-[11px] @xl:not-sr-only', MUTED)}>{t('totalTrip')}</dt>
                                            <dd className={cn('text-[12px] @xl:text-[15px] @xl:font-bold', TEXT)}>{formatDuration(total)}</dd>
                                        </div>
                                    )}
                                    {waiting > 0 && (
                                        <div className="hidden @xl:block">
                                            <dt className={cn('text-[11px]', MUTED)}>{t('layoverLabel')}</dt>
                                            <dd className={cn('text-[15px] font-bold', TEXT)}>{formatDuration(waiting)}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            <div className="mt-4 grid grid-cols-[minmax(3.25rem,auto)_16px_minmax(0,1fr)] gap-x-2.5 @xl:mt-5 @xl:grid-cols-[minmax(4rem,auto)_16px_minmax(0,1.2fr)_minmax(0,1fr)] @xl:gap-x-4">
                                {segments.map((seg, j) => {
                                    const next = segments[j + 1];
                                    const wait = next ? clock.layover(seg.arrival?.time, next.departure?.time) : null;
                                    const showWait = next != null && wait != null;
                                    return (
                                        <React.Fragment key={`${index}-${j}`}>
                                            <StopTime clock={clock} at={seg.departure?.time} />
                                            {/* Narrow, the flight's own line on the rail is a row of its own, so the
                                                line runs down beside it too. */}
                                            <span aria-hidden className="col-start-2 row-span-2 flex flex-col items-center @xl:row-span-1">
                                                <span className={cn(DOT, DOT_DEPART)} />
                                                <span className={RAIL_FLYING} />
                                            </span>
                                            <Stop end={seg.departure} code={seg.origin} className="pb-3.5 @xl:pb-7" />
                                            <Leg segment={seg} />

                                            <StopTime clock={clock} at={seg.arrival?.time} days={clock.dayOffset(seg.departure?.time, seg.arrival?.time)} />
                                            <span aria-hidden className={cn('col-start-2 flex flex-col items-center', showWait && 'row-span-2')}>
                                                <span className={cn(DOT, DOT_ARRIVE)} />
                                                {next && <span className={RAIL_WAITING} />}
                                            </span>
                                            <Stop end={seg.arrival} code={seg.destination} className={next ? 'pb-3 @xl:pb-4' : undefined} />
                                            {showWait && <Layover minutes={wait} from={seg} to={next} />}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>

            <p className={cn('mt-4 border-t pt-3 text-[11px] @xl:mt-[22px] @xl:pt-3.5 @xl:text-[12px]', HAIRLINE, MUTED)}>
                {terminalsPending ? t('footnoteTerminals') : t('footnote')}
            </p>
        </div>
    );
}

export default FlightItinerary;
