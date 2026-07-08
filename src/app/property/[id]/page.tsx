'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { PropertyGallery } from '@/features/hotels/components/property-gallery';
import { PropertyInfo } from '@/features/hotels/components/property-info';
import { RoomList, RoomListSkeleton, type RoomOption } from '@/features/hotels/components/room-list';
import { ReviewsSection } from '@/features/hotels/components/reviews-section';
import { type HotelReview } from '@/features/hotels/lib/reviewsUtils';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { http } from '@/shared/lib/http';
import dynamic from 'next/dynamic';

// Both Mapbox + POI fetch require browser — lazy-load with ssr: false
const PoiDiscovery = dynamic(
    () => import('@/features/hotels/components/poi-discovery').then(m => m.PoiDiscovery),
    { ssr: false }
);

const PropertyMapSidebar = dynamic(
    () => import('@/shared/components/map/PropertyMapSidebar').then(m => m.PropertyMapSidebar),
    { ssr: false, loading: () => <div className="w-full h-[200px] rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" /> }
);

// ─── API response shape ───────────────────────────────────────────────────────

interface HotelContent {
    hotel_id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    star_rating: number | null;
    description: string | null;
    images: string[];
    amenities: string[] | null;
    lat: number | null;
    lng: number | null;
}

interface HotelReviewSummary {
    rating: number | string | null;
    reviews_count: number;
}

interface HotelReviewItem {
    reviewer_name: string | null;
    review_date: string | null;
    score: number | string | null;
    pros: string | null;
    cons: string | null;
    traveler_type: string | null;
    language: string | null;
    headline: string | null;
    country: string | null;
}

interface PropertyApiResponse {
    content?: HotelContent;
    reviews?: HotelReviewSummary | null;
    reviewItems?: HotelReviewItem[];
    rooms?: RoomOption[];
    error?: string;
}

// ─── Property info skeleton ───────────────────────────────────────────────────

function PropertyInfoSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2 pt-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-lg" />)}
            </div>
        </div>
    );
}

// ─── Inner page content (uses useParams / useSearchParams) ────────────────────

function PropertyContent() {
    const params       = useParams();
    const searchParams = useSearchParams();

    const hotelId  = params.id as string;
    const checkIn  = searchParams.get('checkIn')  ?? '';
    const checkOut = searchParams.get('checkOut') ?? '';
    const adults   = Number(searchParams.get('adults')   ?? 2);
    const children = Number(searchParams.get('children') ?? 0);

    // For the "Back to results" link
    const destination = searchParams.get('destination') ?? '';
    const backHref    = destination
        ? `/hotels/search?${searchParams.toString()}`
        : '/hotels/search';

    const [data, setData]     = useState<PropertyApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);

    useEffect(() => {
        if (!hotelId) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        const qs = new URLSearchParams();
        if (checkIn)  qs.set('checkIn', checkIn);
        if (checkOut) qs.set('checkOut', checkOut);
        if (adults)   qs.set('adults', String(adults));
        if (children) qs.set('children', String(children));

        http
            .get<PropertyApiResponse>(`/api/hotels/property/${hotelId}?${qs.toString()}`)
            .then((res) => { if (!cancelled) setData(res); })
            .catch((err: Error) => { if (!cancelled) setError(err.message ?? 'Failed to load property'); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [hotelId, checkIn, checkOut, adults, children]);

    const content  = data?.content;
    const rooms    = data?.rooms ?? [];

    // Map snake_case API fields to camelCase for components
    const property = content ? {
        id:           content.hotel_id,
        name:         content.name ?? '',
        address:      content.address ?? undefined,
        city:         content.city ?? undefined,
        country:      content.country ?? undefined,
        starRating:   content.star_rating ?? undefined,
        reviewScore:  data?.reviews?.rating ?? undefined,
        reviewCount:  data?.reviews?.reviews_count ?? undefined,
        description:  content.description ?? undefined,
        images:       content.images,
        amenities:    content.amenities ?? undefined,
        coordinates:  (content.lat && content.lng) ? { lat: content.lat, lng: content.lng } : undefined,
    } : null;

    const reviewItems: HotelReview[] = (data?.reviewItems ?? []).map(r => ({
        averageScore: Number(r.score ?? 0),
        name:         r.reviewer_name ?? 'Anonymous',
        date:         r.review_date ?? '',
        headline:     r.headline ?? undefined,
        pros:         r.pros ?? undefined,
        cons:         r.cons ?? undefined,
        country:      r.country ?? undefined,
        type:         r.traveler_type ?? undefined,
        language:     r.language ?? undefined,
    }));

    // ── Error ──────────────────────────────────────────────────────────────────
    if (!loading && (error || !content)) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {error ?? 'Property not found.'}
                </p>
                <Link href="/hotels/search" className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
                    Back to search
                </Link>
            </div>
        );
    }

    return (
        <div className="flex-1 max-w-[1200px] mx-auto w-full px-4 py-6 space-y-6">
            {/* Back nav */}
            <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
                <ArrowLeft size={13} />
                Back to results
            </Link>

            {/* Gallery */}
            {loading ? (
                <Skeleton className="w-full h-[230px] md:h-[400px] rounded-xl" />
            ) : (
                <PropertyGallery images={property?.images ?? []} name={property?.name ?? ''} />
            )}

            {/* Body: info + rooms */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: info */}
                <div className="flex-1 min-w-0 space-y-8">
                    {loading ? (
                        <PropertyInfoSkeleton />
                    ) : property ? (
                        <>
                            <PropertyInfo
                                name={property.name}
                                address={property.address}
                                city={property.city}
                                country={property.country}
                                starRating={property.starRating}
                                reviewScore={Number(property.reviewScore ?? 0) || undefined}
                                reviewCount={property.reviewCount}
                                description={property.description}
                                amenities={property.amenities}
                            />

                            <hr className="border-slate-200 dark:border-white/10" />

                            {/* Date / stay summary */}
                            {(checkIn || checkOut) && (
                                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Your stay</p>
                                    <div className="flex flex-wrap gap-4 text-xs text-blue-600 dark:text-blue-400">
                                        {checkIn  && <span>Check-in: <strong>{checkIn}</strong></span>}
                                        {checkOut && <span>Check-out: <strong>{checkOut}</strong></span>}
                                        <span>{adults} adult{adults !== 1 ? 's' : ''}{children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}</span>
                                    </div>
                                </div>
                            )}

                            {/* Rooms */}
                            {loading ? (
                                <RoomListSkeleton />
                            ) : (
                                <RoomList
                                    hotelId={hotelId}
                                    rooms={rooms}
                                    checkIn={checkIn}
                                    checkOut={checkOut}
                                    adults={adults}
                                    children={children}
                                />
                            )}

                            {/* Guest reviews */}
                            {!loading && reviewItems.length > 0 && (
                                <>
                                    <hr className="border-slate-200 dark:border-white/10" />
                                    <ReviewsSection
                                        reviews={reviewItems}
                                        averageRating={Number(data?.reviews?.rating ?? 0)}
                                        totalCount={data?.reviews?.reviews_count ?? 0}
                                    />
                                </>
                            )}

                            {/* Nearby POI discovery */}
                            {!loading && property.coordinates && (
                                <>
                                    <hr className="border-slate-200 dark:border-white/10" />
                                    <PoiDiscovery coordinates={property.coordinates} />
                                </>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Right: sticky summary on desktop */}
                {property && (
                    <aside className="hidden lg:block w-72 shrink-0">
                        <div className="sticky top-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 space-y-4">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">
                                {property.name}
                            </h3>
                            {(checkIn || checkOut) && (
                                <dl className="space-y-1.5 text-xs">
                                    {checkIn && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                            <dt className="text-slate-400">Check-in</dt>
                                            <dd className="font-medium">{checkIn}</dd>
                                        </div>
                                    )}
                                    {checkOut && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                            <dt className="text-slate-400">Check-out</dt>
                                            <dd className="font-medium">{checkOut}</dd>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                        <dt className="text-slate-400">Guests</dt>
                                        <dd className="font-medium">{adults} adult{adults !== 1 ? 's' : ''}{children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}</dd>
                                    </div>
                                </dl>
                            )}
                            {rooms.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                                    <p className="text-xs text-slate-400 mb-1">From</p>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {rooms[0].currency} {Math.min(...rooms.map((r) => r.price)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-[10px] text-slate-400">/night</p>
                                </div>
                            )}
                            <a
                                href="#rooms"
                                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                            >
                                See available rooms
                            </a>

                            {/* Map — only shown when coordinates are available */}
                            {property.coordinates && (
                                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                                    <p className="text-xs text-slate-400 mb-2">Location</p>
                                    <PropertyMapSidebar
                                        property={{
                                            id: property.id,
                                            name: property.name,
                                            coordinates: property.coordinates,
                                        }}
                                        className="w-full h-[200px] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10"
                                    />
                                </div>
                            )}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HotelPropertyPage() {
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
                <PropertyContent />
            </Suspense>
            <Footer />
        </div>
    );
}
