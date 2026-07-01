'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import { http } from '@/shared/lib/http';
import type { HotelResult } from '@/features/hotels/components/hotel-card';

// ─── Search API response shape ────────────────────────────────────────────────

interface HotelSearchResponse {
    hotels?: HotelResult[];
    properties?: HotelResult[];
    totalCount?: number;
    error?: string;
}

// ─── Inner client component (reads searchParams) ──────────────────────────────

function HotelSearchContent() {
    const searchParams = useSearchParams();

    const destination  = searchParams.get('destination') ?? '';
    const checkIn      = searchParams.get('checkIn')      ?? '';
    const checkOut     = searchParams.get('checkOut')     ?? '';
    const adults       = searchParams.get('adults')       ?? '2';
    const children     = searchParams.get('children')     ?? '0';
    const rooms        = searchParams.get('rooms')        ?? '1';
    const lat          = searchParams.get('lat')          ?? '';
    const lng          = searchParams.get('lng')          ?? '';
    const countryCode  = searchParams.get('countryCode')  ?? '';

    const [hotels, setHotels]   = useState<HotelResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    // Preserve search params for property detail links
    const searchQs = searchParams.toString();

    useEffect(() => {
        if (!destination && !lat) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setHotels([]);

        http
            .post<HotelSearchResponse>('/api/hotels/search', {
                destination,
                checkIn,
                checkOut,
                adults:  Number(adults),
                children: Number(children),
                rooms:   Number(rooms),
                lat:     lat ? Number(lat) : undefined,
                lng:     lng ? Number(lng) : undefined,
                countryCode: countryCode || undefined,
            })
            .then((res) => {
                if (cancelled) return;
                const list = res.hotels ?? res.properties ?? [];
                setHotels(list);
            })
            .catch((err: Error) => {
                if (cancelled) return;
                setError(err.message ?? 'Search failed');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [destination, checkIn, checkOut, adults, children, rooms, lat, lng, countryCode]);

    return (
        <div className="flex-1 px-4 py-6 max-w-[1200px] mx-auto w-full">
            {/* Breadcrumb */}
            <nav className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                <span>Hotels</span>
                {destination && (
                    <>
                        <span className="mx-1.5">›</span>
                        <span className="text-slate-600 dark:text-slate-300">{destination}</span>
                    </>
                )}
                {checkIn && checkOut && (
                    <>
                        <span className="mx-1.5">›</span>
                        <span>{checkIn} — {checkOut}</span>
                    </>
                )}
            </nav>

            <HotelResults
                hotels={hotels}
                loading={loading}
                error={error}
                destination={destination}
                searchQs={searchQs}
            />
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HotelSearchPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <Suspense
                fallback={
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                    </div>
                }
            >
                <HotelSearchContent />
            </Suspense>
            <Footer />
        </div>
    );
}
