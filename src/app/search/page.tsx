'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import { http } from '@/shared/lib/http';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import type { MappableProperty } from '@/shared/components/map/types';

// Mapbox requires browser — always lazy-load with ssr: false
const SearchMapContainer = dynamic(
    () => import('@/shared/components/mapbox/SearchMapContainer').then(m => m.SearchMapContainer),
    { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 dark:bg-slate-900 animate-pulse rounded-xl" /> }
);

// ─── Search API response shape ────────────────────────────────────────────────

interface HotelSearchResponse {
    hotels?: HotelResult[];
    properties?: HotelResult[];
    totalCount?: number;
    error?: string;
}

// ─── Adapter: HotelResult → MappableProperty ─────────────────────────────────

function toMappable(h: HotelResult): MappableProperty | null {
    if (!h.lat || !h.lng) return null;
    return {
        id: h.id,
        name: h.name,
        price: h.price,
        currency: h.currency,
        coordinates: { lat: h.lat, lng: h.lng },
        images: h.images,
        image: h.images?.[0],
        rating: h.reviewScore,
        reviewScore: h.reviewScore,
        reviewCount: h.reviewCount,
        refundableTag: h.refundableTag,
        starRating: h.starRating,
        location: h.location,
        city: h.city,
        country: h.country,
        boardType: h.boardType,
    };
}

// ─── Inner client component (reads searchParams) ──────────────────────────────

function HotelSearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

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

    // Map selection state
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId]   = useState<string | null>(null);

    const searchQs = searchParams.toString();

    useEffect(() => {
        if (!destination && !lat) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setHotels([]);
        setSelectedId(null);

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

    // Derive mappable properties (hotels that have coordinates)
    const mappableProperties = React.useMemo<MappableProperty[]>(() => {
        const result: MappableProperty[] = [];
        for (const h of hotels) {
            const m = toMappable(h);
            if (m) result.push(m);
        }
        return result;
    }, [hotels]);

    const defaultCenter = lat && lng
        ? { lat: Number(lat), lng: Number(lng) }
        : undefined;

    const handleViewDetails = (id: string) => {
        router.push(`/property/${id}?${searchQs}`);
    };

    return (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* ── Left: Hotel list ──────────────────────────────────────────── */}
            <div className="flex-1 lg:max-w-[600px] xl:max-w-[680px] overflow-y-auto px-4 py-6">
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

            {/* ── Right: Map ───────────────────────────────────────────────── */}
            <div className="hidden lg:flex flex-1 sticky top-0 h-screen">
                <div className="w-full h-full p-3">
                    <SearchMapContainer
                        properties={mappableProperties}
                        selectedId={selectedId}
                        onSelectId={setSelectedId}
                        hoveredId={hoveredId}
                        onHoverId={setHoveredId}
                        onViewDetails={handleViewDetails}
                        defaultCenter={defaultCenter}
                    />
                </div>
            </div>
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
