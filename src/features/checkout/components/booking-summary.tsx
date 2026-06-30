'use client';

import React from 'react';
import { Calendar, MapPin, Plane, Hotel, Users, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotelSummaryData {
    mode: 'hotel';
    hotelName: string;
    roomName?: string;
    checkIn: string;   // YYYY-MM-DD
    checkOut: string;  // YYYY-MM-DD
    adults: number;
    totalPrice: number;
    currency: string;
    starRating?: number;
}

interface FlightSummaryData {
    mode: 'flight';
    origin: string;
    destination: string;
    departureDate: string; // ISO or YYYY-MM-DD
    cabin?: string;
    totalAmount: number;
    currency: string;
    passengers?: number;
}

type BookingSummaryData = HotelSummaryData | FlightSummaryData;

interface BookingSummaryProps {
    data: BookingSummaryData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function nightsBetween(checkIn: string, checkOut: string): number {
    const ci = new Date(checkIn).getTime();
    const co = new Date(checkOut).getTime();
    return Math.max(1, Math.round((co - ci) / (1000 * 60 * 60 * 24)));
}

const CARD =
    'rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm';

const ROW = 'flex items-center justify-between text-sm';

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingSummary({ data }: BookingSummaryProps) {
    if (data.mode === 'hotel') {
        const nights = nightsBetween(data.checkIn, data.checkOut);
        const perNight = nights > 0 ? data.totalPrice / nights : data.totalPrice;

        return (
            <div className={cn(CARD, 'space-y-4')}>
                {/* Header */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Hotel size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Hotel</p>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate">
                            {data.hotelName}
                        </h3>
                    </div>
                </div>

                {/* Stars */}
                {data.starRating && data.starRating > 0 && (
                    <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.round(data.starRating) }).map((_, i) => (
                            <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                        ))}
                    </div>
                )}

                <div className="border-t border-dashed border-slate-200 dark:border-white/10 pt-4 space-y-3">
                    {/* Dates */}
                    <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Calendar size={14} className="mt-0.5 text-slate-400 shrink-0" />
                        <div>
                            <p className="font-medium">{formatDate(data.checkIn)} → {formatDate(data.checkOut)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {nights} {nights === 1 ? 'night' : 'nights'}
                            </p>
                        </div>
                    </div>

                    {/* Guests */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span>{data.adults} {data.adults === 1 ? 'adult' : 'adults'}</span>
                    </div>

                    {/* Room */}
                    {data.roomName && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Hotel size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">{data.roomName}</span>
                        </div>
                    )}
                </div>

                {/* Price Breakdown */}
                <div className="border-t border-dashed border-slate-200 dark:border-white/10 pt-4 space-y-2">
                    <div className={cn(ROW, 'text-slate-500 dark:text-slate-400 text-xs')}>
                        <span>1 room × {nights} {nights === 1 ? 'night' : 'nights'}</span>
                        <span>{data.currency} {perNight.toLocaleString(undefined, { maximumFractionDigits: 0 })} / night</span>
                    </div>
                    <div className={cn(ROW, 'font-bold text-base pt-1 border-t border-slate-200 dark:border-white/10 mt-2')}>
                        <span className="text-slate-900 dark:text-white">Total</span>
                        <span className="text-blue-600 dark:text-blue-400">
                            {data.currency} {data.totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Flight mode
    return (
        <div className={cn(CARD, 'space-y-4')}>
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                    <Plane size={16} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Flight</p>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {data.origin} → {data.destination}
                    </h3>
                </div>
            </div>

            <div className="border-t border-dashed border-slate-200 dark:border-white/10 pt-4 space-y-3">
                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <span>{formatDate(data.departureDate)}</span>
                </div>

                {/* Route */}
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span>{data.origin} to {data.destination}</span>
                </div>

                {/* Cabin */}
                {data.cabin && (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 capitalize">
                            {data.cabin.replace('_', ' ')}
                        </span>
                    </div>
                )}

                {/* Passengers */}
                {data.passengers && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span>{data.passengers} {data.passengers === 1 ? 'passenger' : 'passengers'}</span>
                    </div>
                )}
            </div>

            {/* Total */}
            <div className="border-t border-dashed border-slate-200 dark:border-white/10 pt-4">
                <div className={cn(ROW, 'font-bold text-base')}>
                    <span className="text-slate-900 dark:text-white">Total</span>
                    <span className="text-violet-600 dark:text-violet-400">
                        {data.currency} {parseFloat(data.totalAmount as unknown as string).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </div>
            </div>
        </div>
    );
}
