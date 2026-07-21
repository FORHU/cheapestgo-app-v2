'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, ArrowRight, Luggage, ChevronDown, ChevronUp, Shield, XCircle, BadgeDollarSign, Users, Heart } from 'lucide-react';
import type { FlightOffer, NormalizedSegment } from '@/shared/types';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { SaveButton } from './SaveButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso?: string): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

function providerLabel(provider: string): string {
    if (provider === 'mystifly_v2' || provider === 'mystifly') return 'Mystifly';
    if (provider === 'duffel') return 'Duffel';
    return provider;
}

function stopsLabel(stops: number): string {
    if (stops === 0) return 'Direct';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
}

/** Groups flat segments into slices by segmentIndex */
function groupSegmentsIntoSlices(segments: NormalizedSegment[]): NormalizedSegment[][] {
    const map = new Map<number, NormalizedSegment[]>();
    for (const seg of segments) {
        const idx = seg.segmentIndex ?? 0;
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(seg);
    }
    return Array.from(map.values());
}

// ─── Airline Logo ─────────────────────────────────────────────────────────────

function AirlineLogo({ code, name }: { code: string; name?: string }) {
    const [failed, setFailed] = useState(false);
    const iata = (code ?? '').toUpperCase().slice(0, 3);
    const initials = iata.slice(0, 2) || (name ?? '??').slice(0, 2).toUpperCase();

    if (iata && !failed) {
        return (
            <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-md bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={`https://pics.avs.io/40/40/${iata}.png`}
                    alt={name ?? iata}
                    className="w-4 h-4 lg:w-6 lg:h-6 object-contain"
                    onError={() => setFailed(true)}
                />
            </div>
        );
    }

    return (
        <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-md bg-slate-600 flex items-center justify-center text-white font-bold text-[9px] lg:text-xs shrink-0">
            {initials}
        </div>
    );
}

// ─── Segment Row (for expanded view) ──────────────────────────────────────────

function SegmentRow({ segment }: { segment: NormalizedSegment }) {
    return (
        <div className="flex items-center gap-2 lg:gap-4 py-1.5 lg:py-2.5 px-1">
            <AirlineLogo code={segment.airline} name={segment.airlineName} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 lg:gap-2 text-[9px] lg:text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium truncate">{segment.airlineName || segment.airline}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span>{segment.flightNumber}</span>
                    {segment.aircraft && (
                        <>
                            <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
                            <span className="hidden sm:inline">{segment.aircraft}</span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-1.5 lg:gap-3 mt-0.5 lg:mt-1.5">
                    <div className="text-center min-w-[40px] lg:min-w-[56px]">
                        <div className="text-xs lg:text-base font-semibold text-slate-900 dark:text-white">{formatTime(segment.departure?.time)}</div>
                        <div className="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400">{segment.origin}</div>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-0 lg:gap-0.5 min-w-[60px] lg:min-w-[90px]">
                        <span className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500">{formatDuration(segment.duration)}</span>
                        <div className="w-full flex items-center gap-0.5">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
                            <Plane className="w-2 h-2 lg:w-3 lg:h-3 text-indigo-500 rotate-90 shrink-0" />
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
                        </div>
                        <span className="text-[10px] lg:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {segment.stops === 0 ? 'Direct' : stopsLabel(segment.stops ?? 0)}
                        </span>
                    </div>

                    <div className="text-center min-w-[40px] lg:min-w-[56px]">
                        <div className="text-xs lg:text-base font-semibold text-slate-900 dark:text-white">{formatTime(segment.arrival?.time)}</div>
                        <div className="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400">{segment.destination}</div>
                    </div>
                </div>
            </div>
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
}

export function FlightCard({ offer, adults = 1, className, index = 0, onSelect, isSelected = false }: FlightCardProps) {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);

    const segments = offer.segments ?? [];
    const slices = groupSegmentsIntoSlices(segments);

    // Primary metrics for the collapsed card view
    const primary = segments[0];
    const last = segments[segments.length - 1];

    if (!primary || !last) return null;

    const priceTotal = offer.price?.total ?? 0;
    const currency = offer.price?.currency ?? 'USD';
    // Use pricePerAdult if available; fallback to dividing by adults
    const pricePerPerson = offer.price?.pricePerAdult ?? (adults > 0 ? priceTotal / adults : priceTotal);

    const handleSelect = (selectedOffer: FlightOffer) => {
        if (onSelect) {
            onSelect(selectedOffer);
        } else {
            sessionStorage.setItem('selectedFlight', JSON.stringify(selectedOffer));
            router.push(`/flights/book?offerId=${encodeURIComponent(selectedOffer.offerId)}`);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
            className={cn(
                'group relative bg-white dark:bg-slate-900 w-full',
                'rounded-md overflow-hidden border transition-all duration-200',
                isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                    : 'border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg',
                className
            )}
        >
            {/* ─── Save/Heart Button (mobile only — top-right corner) ─── */}
            <div className="absolute top-2 right-2 z-10 lg:hidden">
                <SaveButton
                    type="flight"
                    title={`${primary.origin} → ${last.destination} · ${primary.departure?.time?.slice(0, 10) ?? ''}`}
                    subtitle={`${primary.airlineName || primary.airline} · ${formatDuration(offer.totalDuration)} · ${stopsLabel(offer.totalStops)}`}
                    price={offer.price.total}
                    currency={offer.price.currency}
                    imageUrl={`https://pics.avs.io/40/40/${(primary.airline || '').toUpperCase()}.png`}
                    deepLink={`/flights/search?origin=${primary.origin}&destination=${last.destination}&departure=${primary.departure?.time?.slice(0, 10) ?? ''}`}
                    snapshot={{ offerId: offer.offerId, provider: offer.provider }}
                    size="sm"
                />
            </div>

            <div className="flex flex-col lg:flex-row">
                {/* ─── Flight Info + Expand (left) ─── */}
                <div className="flex-1 min-w-0">
                    <div className="px-3 py-2 lg:px-4 lg:py-2.5">
                        {/* Airline header */}
                        <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-1.5">
                            <AirlineLogo code={primary.airline} name={primary.airlineName} />
                            <div className="min-w-0">
                                <div className="flex items-center gap-1 lg:gap-2">
                                    <span className="font-normal text-blue-600 dark:text-blue-400 text-[10px] lg:text-xs">
                                        {primary.airlineName || primary.airline}
                                    </span>
                                </div>
                                <div className="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400">
                                    {primary.flightNumber}
                                    {segments.length > 1 && ` + ${segments.length - 1} more`}
                                </div>
                            </div>
                        </div>

                        {/* Route timeline */}
                        <div className="flex items-center gap-1.5 lg:gap-3 min-w-0 w-full">
                            <div className="text-center">
                                <div className="text-xs lg:text-base font-normal text-slate-900 dark:text-white leading-tight">{formatTime(primary.departure?.time)}</div>
                                <div className="text-[8px] lg:text-[10px] text-slate-500 dark:text-slate-400 font-normal">{primary.origin}</div>
                            </div>

                            <div className="flex-1 flex flex-col items-center gap-0">
                                <span className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500 font-normal">{formatDuration(offer.totalDuration)}</span>
                                <div className="w-full flex items-center gap-0.5 max-w-[200px]">
                                    <div className="h-[1.5px] lg:h-[2px] flex-1 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full" />
                                    <Plane className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-indigo-500 rotate-90 shrink-0" />
                                </div>
                                <span className={cn(
                                    "text-[10px] lg:text-xs font-normal",
                                    offer.totalStops === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                )}>
                                    {stopsLabel(offer.totalStops)}
                                </span>
                            </div>

                            <div className="text-center">
                                <div className="text-xs lg:text-base font-normal text-slate-900 dark:text-white leading-tight">{formatTime(last.arrival?.time)}</div>
                                <div className="text-[8px] lg:text-[10px] text-slate-500 dark:text-slate-400 font-normal">{last.destination}</div>
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-0.5 lg:gap-1 mt-1 lg:mt-1.5 min-w-0 overflow-hidden">
                            {/* Baggage */}
                            {offer.baggage && (() => {
                                const checkedBags = offer.baggage?.checkedBags ?? 0;
                                return (
                                <span className="inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[8px] lg:text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                    <Luggage className="w-2 h-2 lg:w-3 lg:h-3" />
                                    {checkedBags > 0
                                        ? `${checkedBags} Checked Bag${checkedBags > 1 ? 's' : ''}`
                                        : 'No Checked Bag'}
                                </span>
                                );
                            })()}

                            {/* Refundability */}
                            {(() => {
                                const fp = offer.farePolicy;
                                const isRefundable = fp ? fp.isRefundable : offer.refundable;
                                const penalty = fp?.refundPenaltyAmount;

                                if (isRefundable && penalty === 0) {
                                    return (
                                        <span className="inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[8px] lg:text-xs bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                                            <Shield className="w-2 h-2 lg:w-3 lg:h-3" />
                                            Free Cancellation
                                        </span>
                                    );
                                } else if (isRefundable) {
                                    const feeLabel = penalty != null && penalty > 0
                                        ? `Refundable (est. fee: ${formatPrice(penalty, fp?.refundPenaltyCurrency ?? 'USD')})`
                                        : 'Refundable (fees may apply)';
                                    return (
                                        <span className="inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[8px] lg:text-xs bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                                            <BadgeDollarSign className="w-2 h-2 lg:w-3 lg:h-3" />
                                            {feeLabel}
                                        </span>
                                    );
                                } else {
                                    return (
                                        <span className="inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[8px] lg:text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                                            <XCircle className="w-2 h-2 lg:w-3 lg:h-3" />
                                            Non-refundable
                                        </span>
                                    );
                                }
                            })()}

                            {/* Cabin Class */}
                            <span className="inline-flex items-center px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[8px] lg:text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 capitalize">
                                {(primary.cabinClass || 'economy').replace('_', ' ')}
                            </span>

                            {/* Provider */}
                            <span className="inline-flex items-center px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[8px] lg:text-xs bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                                {providerLabel(offer.provider)}
                            </span>

                            {/* Alternatives badge */}
                            {offer.alternatives && offer.alternatives.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[9px] lg:text-xs bg-indigo-600 text-white font-normal animate-pulse shadow-sm shadow-indigo-500/50">
                                    <BadgeDollarSign className="w-2 h-2 lg:w-3 lg:h-3" />
                                    {offer.alternatives.length + 1} Fare Options
                                </span>
                            )}

                            {/* Aircraft */}
                            {primary.aircraft && (
                                <span className="inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[9px] lg:text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                    <Plane className="w-2 h-2 lg:w-3 lg:h-3" />
                                    {primary.aircraft}
                                </span>
                            )}

                            {/* Seats — show for any positive value */}
                            {offer.seatsRemaining != null && offer.seatsRemaining > 0 && (
                                <span className={cn(
                                    "inline-flex items-center gap-0.5 px-1 lg:px-2 py-px lg:py-0.5 rounded-full text-[9px] lg:text-xs font-normal border",
                                    offer.seatsRemaining <= 3
                                        ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                        : offer.seatsRemaining <= 6
                                            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                            : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                )}>
                                    <Users className="w-2 h-2 lg:w-3 lg:h-3" />
                                    {offer.seatsRemaining} seat{offer.seatsRemaining !== 1 ? 's' : ''} left
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ─── Expand Toggle ─── */}
                    {segments.length > 1 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-0.5 px-3 lg:px-4 pb-1.5 text-[10px] lg:text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
                        >
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {expanded ? 'Hide details' : (offer.alternatives && offer.alternatives.length > 0 ? `Compare options (${offer.alternatives.length + 1})` : 'Show all segments')}
                        </button>
                    )}

                    {/* ─── Expanded View (Details + Alternatives) ─── */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                                className="border-t border-slate-100 dark:border-slate-800 overflow-hidden"
                            >
                                {/* Alternatives / Brands Section */}
                                {offer.alternatives && offer.alternatives.length > 0 && (
                                    <div className="bg-slate-50/50 dark:bg-slate-800/20 px-2.5 lg:px-5 py-3 lg:py-4 border-b border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[11px] font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <BadgeDollarSign className="w-3.5 h-3.5 text-indigo-500" />
                                            Available Fare Options
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {/* Current main offer as one of the options */}
                                            <div className="flex flex-col p-2.5 rounded-lg border-2 border-indigo-500 bg-white dark:bg-slate-900 shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded uppercase">
                                                        {offer.brandedFare?.brandName || offer.brandedFare?.fareType || 'Standard'}
                                                    </span>
                                                    <span className="text-xs font-normal text-slate-900 dark:text-white">
                                                        {formatPrice(offer.price.total, offer.price.currency)}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 italic mb-2">
                                                    {(primary.cabinClass || 'economy').replace('_', ' ')} · Best Value
                                                </p>
                                                <button
                                                    disabled
                                                    className="mt-auto py-1 px-3 rounded bg-indigo-600 text-white text-[10px] font-normal opacity-50 cursor-default"
                                                >
                                                    Currently Selected
                                                </button>
                                            </div>

                                            {/* Alternatives */}
                                            {offer.alternatives.map((alt) => (
                                                <div key={alt.offerId} className="flex flex-col p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-[11px] font-normal text-slate-600 dark:text-slate-300 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded uppercase">
                                                            {alt.brandedFare?.brandName || alt.brandedFare?.fareType || 'Option'}
                                                        </span>
                                                        <span className="text-xs font-normal text-slate-900 dark:text-white">
                                                            {formatPrice(alt.price?.total ?? 0, alt.price?.currency ?? 'USD')}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 italic mb-2">
                                                        {(alt.segments[0]?.cabinClass || 'economy').replace('_', ' ')}
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelect(alt);
                                                        }}
                                                        className="mt-auto py-1 px-3 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-normal transition-colors"
                                                    >
                                                        Select {alt.brandedFare?.brandName || alt.brandedFare?.fareType || 'this fare'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Flight Detail Segments */}
                                <div className="px-2.5 lg:px-5 pb-2 lg:pb-4 space-y-0.5 lg:space-y-1">
                                    {slices.map((sliceSegs, routeIndex) => {
                                        if (!sliceSegs || sliceSegs.length === 0) return null;

                                        let label = `Leg ${routeIndex + 1}`;
                                        if (slices.length === 2) {
                                            label = routeIndex === 0 ? 'Outbound' : 'Return';
                                        }

                                        return (
                                            <div className="pt-3" key={routeIndex}>
                                                <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                    {label}
                                                </div>
                                                {sliceSegs.map((seg, i) => (
                                                    <SegmentRow key={`${routeIndex}-${i}`} segment={seg} />
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ─── Price + CTA (right) ─── */}
                <div className="relative flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-between gap-1 lg:gap-1.5 lg:w-[180px] px-3 py-1.5 lg:py-3 lg:px-4 lg:border-l border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">

                    {/* Heart button — desktop only, inline */}
                    <div className="hidden lg:flex justify-end w-full mb-1 relative z-10">
                        <SaveButton
                            type="flight"
                            title={`${primary.origin} → ${last.destination} · ${primary.departure?.time?.slice(0, 10) ?? ''}`}
                            subtitle={`${primary.airlineName || primary.airline} · ${formatDuration(offer.totalDuration)} · ${stopsLabel(offer.totalStops)}`}
                            price={offer.price.total}
                            currency={offer.price.currency}
                            imageUrl={`https://pics.avs.io/40/40/${(primary.airline || '').toUpperCase()}.png`}
                            deepLink={`/flights/search?origin=${primary.origin}&destination=${last.destination}&departure=${primary.departure?.time?.slice(0, 10) ?? ''}`}
                            snapshot={{ offerId: offer.offerId, provider: offer.provider }}
                            size="sm"
                        />
                    </div>

                    <div className="lg:text-right">
                        <div className="text-xs lg:text-lg font-normal text-slate-900 dark:text-white leading-tight">
                            {formatPrice(pricePerPerson, currency)}<span className="text-[8px] lg:text-xs text-slate-400 dark:text-slate-500">/person</span>
                        </div>
                        <div className="text-[9px] lg:text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            includes taxes & fees
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:mt-auto">
                        <button
                            onClick={() => handleSelect(offer)}
                            className="px-4 lg:px-6 py-1 lg:py-2 rounded-full lg:rounded-lg lg:w-auto bg-blue-600 hover:bg-blue-700 text-white font-normal text-[10px] lg:text-sm transition-colors flex items-center justify-center gap-1 shrink-0"
                        >
                            Select
                            <ArrowRight className="w-3 h-3 lg:w-4 lg:h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default FlightCard;
