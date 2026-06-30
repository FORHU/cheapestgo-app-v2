'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { HotelCard, HotelCardSkeleton, type HotelResult } from '@/features/hotels/components/hotel-card';
import { http } from '@/shared/lib/http';
import { Tag, Hotel } from 'lucide-react';

interface DealsResponse {
    deals?: HotelResult[];
    hotels?: HotelResult[];
    data?: HotelResult[];
}

export default function DealsPage() {
    const [deals, setDeals]     = useState<HotelResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        http
            .get<DealsResponse>('/api/hotels/deals?limit=24')
            .then((res) => {
                if (cancelled) return;
                const list = res.deals ?? res.hotels ?? res.data ?? [];
                setDeals(list);
            })
            .catch((err: Error) => {
                if (cancelled) return;
                setError(err.message ?? 'Failed to load deals');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1 px-4 py-8 max-w-[1200px] mx-auto w-full">
                {/* Page header */}
                <div className="mb-8 space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-semibold">
                        <Tag size={11} />
                        Limited-time offers
                    </div>
                    <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white">
                        Today's Best Hotel Deals
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-xl">
                        Handpicked deals with the lowest prices we could find. Prices update frequently — book early to lock in your rate.
                    </p>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="grid grid-cols-1 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <HotelCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Error state */}
                {!loading && error && (
                    <div className="text-center py-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
                        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                            <Hotel className="w-7 h-7 text-red-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Could not load deals</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">{error}</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && deals.length === 0 && (
                    <div className="text-center py-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <Tag className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No active deals right now</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">
                            Check back soon — we update our deals regularly.
                        </p>
                    </div>
                )}

                {/* Deals grid */}
                {!loading && deals.length > 0 && (
                    <>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                            {deals.length} deal{deals.length !== 1 ? 's' : ''} found
                        </p>
                        <div className="grid grid-cols-1 gap-4">
                            {deals.map((deal, i) => (
                                <HotelCard key={deal.id} hotel={deal} index={i} />
                            ))}
                        </div>
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}
