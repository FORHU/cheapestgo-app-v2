'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Plane, Hotel as HotelIcon, Trash2, ExternalLink, ArrowRight } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';
import type { SavedTrip } from '@/shared/types';

export function SavedTripsSection() {
    const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        http.get<SavedTrip[] | { data?: SavedTrip[] }>('/api/bookings/saved-trips')
            .then(res => {
                const data = Array.isArray(res) ? res : (res as { data?: SavedTrip[] }).data ?? [];
                setSavedTrips(data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleRemove = async (id: string) => {
        setRemovingId(id);
        try {
            await http.delete(`/api/bookings/saved-trips/${id}`);
            setSavedTrips(prev => prev.filter(t => t.id !== id));
        } catch {
            // silently ignore
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Saved Trips</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Hotels and flights you've bookmarked.</p>
            </div>

            {savedTrips.length === 0 ? (
                <div className="flex flex-col items-center text-center py-16 px-4">
                    <div className="w-14 h-14 mb-4 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center">
                        <Heart size={24} className="text-rose-300" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No saved trips yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                        Tap the heart icon on any hotel or flight to save it here.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
                    >
                        Explore destinations
                        <ArrowRight size={14} />
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    {savedTrips.map(trip => (
                        <div
                            key={trip.id}
                            className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                        >
                            {/* Type icon */}
                            <div className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                trip.type === 'flight' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-amber-50 dark:bg-amber-900/30'
                            )}>
                                {trip.type === 'flight'
                                    ? <Plane size={15} className="text-blue-600 dark:text-blue-400" />
                                    : <HotelIcon size={15} className="text-amber-600 dark:text-amber-400" />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{trip.title}</p>
                                {trip.subtitle && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{trip.subtitle}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Saved {new Date(trip.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {/* Price */}
                            {trip.price != null && (
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(trip.price, trip.currency)}
                                    </p>
                                    <p className="text-[10px] text-slate-400">per person</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                {trip.deep_link && (
                                    <Link
                                        href={trip.deep_link}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                                        title="Search again"
                                    >
                                        <ExternalLink size={13} />
                                    </Link>
                                )}
                                <button
                                    onClick={() => handleRemove(trip.id)}
                                    disabled={removingId === trip.id}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
                                    title="Remove from saved"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
