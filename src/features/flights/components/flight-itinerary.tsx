'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { FlightOffer, NormalizedSegment, SegmentEnd } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import {
    airportLabel, cabinLabel, dayOffset, formatDateTime, formatDuration, formatTime,
    groupSegmentsBySlice, layoverMinutes,
} from '../lib/flight-utils';

// v1's flight-by-flight itinerary (`FlightItineraryTimeline`), in the flight card's
// materials: each flight as two ends either side of its duration, each end
// carrying what a traveller needs at that airport.

const TITLE = 'text-slate-900 dark:text-slate-50';
const TEXT  = 'text-slate-700 dark:text-slate-100';
const MUTED = 'text-slate-500 dark:text-slate-400';

/**
 * How the itinerary reads its timestamps. An offer's are Local Airport Time, digits read as
 * written — `AIRPORT_CLOCK`, the default. A booking's come back from api-v2 in another form,
 * so the trips screens hand in their own readers (`BOOKING_CLOCK`) and keep this layout.
 */
export interface ItineraryClock {
    time: (iso?: string) => string;
    dateTime: (iso: string | undefined, locale: string) => string;
    /** Whole days from a departure to its arrival — the "+1". */
    dayOffset: (from?: string, to?: string) => number;
    /** Minutes on the ground between a landing and the next take-off. */
    layover: (arrival?: string, departure?: string) => number | null;
}

export const AIRPORT_CLOCK: ItineraryClock = {
    time: formatTime,
    dateTime: formatDateTime,
    dayOffset,
    layover: layoverMinutes,
};

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
    end, code, segment, departedAt, label, align, clock,
}: {
    end: SegmentEnd | undefined;
    code: string;
    segment: NormalizedSegment;
    /** For the arrival end: when this flight left, for the "+1" on an overnight landing. */
    departedAt?: string;
    label: string;
    align: 'left' | 'right';
    clock: ItineraryClock;
}) {
    const t = useTranslations('flights.itinerary');
    const locale = useLocale();
    const days = align === 'right' ? clock.dayOffset(departedAt, end?.time) : 0;

    // Kept italic when the airline has not named one yet, so "we don't know" still
    // reads differently from a confirmed terminal.
    const terminal = end?.terminal
        ? t('terminal', { terminal: end.terminal })
        : <em>{t('terminalUnavailable')}</em>;

    return (
        <div className={cn('flex w-[38%] shrink-0 flex-col sm:w-[34%]', align === 'left' ? 'items-start text-left' : 'items-end text-right')}>
            <span className={cn('text-lg leading-none font-semibold tracking-[-0.01em] whitespace-nowrap md:text-2xl', TITLE)}>
                {clock.time(end?.time)}
                {days > 0 && <sup className={cn('ml-0.5 text-[12px] font-medium', MUTED)}>+{days}</sup>}
            </span>
            <span className={cn('mt-1.5 text-[12px] leading-snug md:text-[13px]', TEXT)}>{airportLabel(end, code)}</span>
            <span className={cn('mt-3 text-[11px] tracking-[0.13em] uppercase md:text-[12px]', MUTED)}>{label}</span>
            <FactList
                align={align}
                items={[
                    clock.dateTime(end?.time, locale),
                    terminal,
                    `${cabinLabel(segment.cabinClass)} ${segment.flightNumber ?? ''}`.trim(),
                    segment.aircraft,
                ]}
            />
        </div>
    );
}

function LegRow({ segment, clock }: { segment: NormalizedSegment; clock: ItineraryClock }) {
    const t = useTranslations('flights.itinerary');
    const duration = formatDuration(segment.duration);

    return (
        <div className="flex items-start justify-between gap-2 md:gap-4">
            <EndColumn end={segment.departure} code={segment.origin} segment={segment} label={t('departFrom')} align="left" clock={clock} />
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 pt-1.5">
                {duration && (
                    <div className={cn('text-center text-[11px] md:text-[12px]', MUTED)}>
                        <span>{t('flightDuration')}</span> <span className={TEXT}>{duration}</span>
                    </div>
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
                clock={clock}
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

/** Flight by flight, each direction under its own name and run time. */
export function FlightItinerary({ offer, className, clock = AIRPORT_CLOCK }: {
    /** An offer, or anything shaped like its flights — a booking's, through `bookingItinerary`. */
    offer: Pick<FlightOffer, 'segments' | 'sliceDurations'>;
    className?: string;
    clock?: ItineraryClock;
}) {
    const t = useTranslations('flights.itinerary');
    const slices = groupSegmentsBySlice(offer.segments ?? []);

    return (
        <div className={cn('flex flex-col gap-7', className)}>
            {slices.map(({ index, segments }, i) => {
                // "Outbound" only means something beside a return, so a
                // single leg goes unnamed — the card above already says it.
                const label = slices.length === 2
                    ? t(i === 0 ? 'outbound' : 'return')
                    : t('legLabel', { number: i + 1 });
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
                                        {t('totalFlightDuration')} <span className={TEXT}>{formatDuration(total)}</span>
                                    </span>
                                )}
                            </div>
                        )}
                        {segments.map((seg, j) => {
                            const prev = segments[j - 1];
                            const lay = prev ? clock.layover(prev.arrival?.time, seg.departure?.time) : null;
                            return (
                                <React.Fragment key={`${index}-${j}`}>
                                    {lay != null && (
                                        <LayoverNote minutes={lay} airport={seg.departure?.airportName || seg.origin} />
                                    )}
                                    <LegRow segment={seg} clock={clock} />
                                </React.Fragment>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

export default FlightItinerary;
