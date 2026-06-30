'use client';

import React, { useEffect, useState, use } from 'react';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import { http } from '@/shared/lib/http';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import { MapPin } from 'lucide-react';

interface HotelSearchResponse {
    hotels?: HotelResult[];
    properties?: HotelResult[];
    totalCount?: number;
    error?: string;
}

/** Convert "bali-indonesia" -> "Bali, Indonesia" */
function slugToDestination(slug: string): string {
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/** Return today + N days as YYYY-MM-DD */
function offsetDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

interface Props {
    params: Promise<{ slug: string }>;
}

export default function DestinationPage({ params }: Props) {
    const { slug } = use(params);

    const destination = slugToDestination(slug);
    const checkIn     = offsetDate(1);
    const checkOut    = offsetDate(4);

    const [hotels, setHotels]   = useState<HotelResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    const searchQs = new URLSearchParams({
        destination,
        checkIn,
        checkOut,
        adults:   '2',
        children: '0',
        rooms:    '1',
    }).toString();

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setHotels([]);

        http
            .post<HotelSearchResponse>('/api/hotels/search', {
                destination,
                checkIn,
                checkOut,
                adults:   2,
                children: 0,
                rooms:    1,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            {/* Hero */}
            <div className="relative bg-gradient-to-br from-blue-700 to-indigo-800 text-white py-16 px-4 text-center overflow-hidden">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative max-w-2xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                        <MapPin size={11} />
                        Destination
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold drop-shadow-lg">{destination}</h1>
                    <p className="text-white/80 text-sm">
                        Hotels available for {checkIn} — {checkOut}
                    </p>
                </div>
            </div>

            {/* Results */}
            <main className="flex-1 px-4 py-8 max-w-[1200px] mx-auto w-full">
                {/* Breadcrumb */}
                <nav className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                    <a href="/" className="hover:text-blue-500 transition-colors">Home</a>
                    <span className="mx-1.5">›</span>
                    <span>Destinations</span>
                    <span className="mx-1.5">›</span>
                    <span className="text-slate-600 dark:text-slate-300">{destination}</span>
                </nav>

                <HotelResults
                    hotels={hotels}
                    loading={loading}
                    error={error}
                    destination={destination}
                    searchQs={searchQs}
                />
            </main>

            <Footer />
        </div>
    );
}
