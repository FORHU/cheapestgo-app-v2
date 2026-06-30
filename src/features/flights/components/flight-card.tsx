'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import type { FlightOffer, FlightSlice } from '@/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function totalStops(slice: FlightSlice): number {
    return Math.max(0, slice.segments.length - 1);
}

// ─── Airline Logo ─────────────────────────────────────────────────────────────

function AirlineLogo({ code, name }: { code: string; name: string }) {
    const [failed, setFailed] = useState(false);
    const iata = code.toUpperCase().slice(0, 3);
    const initials = iata.slice(0, 2) || name.slice(0, 2).toUpperCase();

    if (iata && !failed) {
        return (
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={`https://pics.avs.io/40/40/${iata}.png`}
                    alt={name}
                    className="w-6 h-6 object-contain"
                    onError={() => setFailed(true)}
                />
            </div>
        );
    }

    return (
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {initials}
        </div>
    );
}

// ─── Slice Row ────────────────────────────────────────────────────────────────

function SliceRow({ slice, label }: { slice: FlightSlice; label?: string }) {
    const stops = totalStops(slice);
    const firstSeg = slice.segments[0];
    const carrier = firstSeg.marketingCarrier;

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {label}
                </span>
            )}
            <div className="flex items-center gap-3">
                <AirlineLogo code={carrier.iataCode} name={carrier.name} />

                <div className="flex-1 flex items-center gap-2 min-w-0">
                    {/* Departure */}
                    <div className="text-center min-w-[52px]">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                            {formatTime(slice.departureAt)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {slice.origin.iataCode}
                        </div>
                        <div className="text-[9px] text-slate-400 hidden sm:block">
                            {formatDate(slice.departureAt)}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 flex flex-col items-center gap-0.5 min-w-[60px]">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatDuration(slice.duration)}
                        </span>
                        <div className="w-full flex items-center gap-0.5">
                            <div className="h-px flex-1 bg-gradient-to-r from-slate-300 to-slate-300 dark:from-slate-600 dark:to-slate-600" />
                            <Plane className="w-3 h-3 text-blue-500 rotate-90 shrink-0" />
                            <div className="h-px flex-1 bg-gradient-to-r from-slate-300 to-slate-300 dark:from-slate-600 dark:to-slate-600" />
                        </div>
                        <Badge
                            variant={stops === 0 ? 'success' : 'warning'}
                            size="sm"
                        >
                            {stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`}
                        </Badge>
                    </div>

                    {/* Arrival */}
                    <div className="text-center min-w-[52px]">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                            {formatTime(slice.arrivalAt)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {slice.destination.iataCode}
                        </div>
                        <div className="text-[9px] text-slate-400 hidden sm:block">
                            {formatDate(slice.arrivalAt)}
                        </div>
                    </div>
                </div>

                {/* Airline + flight number */}
                <div className="hidden md:block min-w-[100px] text-right">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {carrier.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                        {firstSeg.operatingCarrierFlightNumber}
                        {slice.segments.length > 1 && ` +${slice.segments.length - 1}`}
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
}

export function FlightCard({ offer, adults = 1, className }: FlightCardProps) {
    const router = useRouter();

    const priceTotal = parseFloat(offer.totalAmount);
    const pricePerAdult = adults > 0 ? priceTotal / adults : priceTotal;
    const isRoundTrip = offer.slices.length > 1;

    const handleSelect = () => {
        // Store in sessionStorage so the booking page can read it without URL params
        sessionStorage.setItem('selectedFlight', JSON.stringify(offer));
        router.push(`/flights/book?offerId=${encodeURIComponent(offer.id)}`);
    };

    return (
        <div
            className={cn(
                'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm',
                'hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200',
                className
            )}
        >
            <div className="flex flex-col lg:flex-row">
                {/* Left: route info */}
                <div className="flex-1 min-w-0 p-4 space-y-3">
                    {offer.slices.map((slice, i) => (
                        <SliceRow
                            key={slice.id}
                            slice={slice}
                            label={isRoundTrip ? (i === 0 ? 'Outbound' : 'Return') : undefined}
                        />
                    ))}

                    {/* Tags row */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <Clock size={10} />
                            {offer.passengers.length} passenger{offer.passengers.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Right: price + CTA */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2 px-4 py-3 lg:py-4 lg:w-44 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="lg:text-right">
                        <div className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                            {offer.totalCurrency}{' '}
                            {priceTotal.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                            })}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {offer.totalCurrency}{' '}
                            {pricePerAdult.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                            })}
                            {' '}/person
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">incl. taxes</div>
                    </div>

                    <Button
                        onClick={handleSelect}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1 shrink-0"
                    >
                        Select
                        <ArrowRight size={14} />
                    </Button>
                </div>
            </div>
        </div>
    );
}
