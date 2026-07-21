'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Heart as HeartFill, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { formatPrice } from '../lib/flight-utils';
import { useAuthStore } from '@/shared/auth/store';

export interface SavedFlight {
    id: string;
    type: 'flight';
    title: string;
    subtitle: string;
    price: number;
    currency: string;
    imageUrl?: string;
    deepLink: string;
    snapshot: { offerId: string; provider: string };
    savedAt: string;
}

const STORAGE_KEY = 'cheapestgo-saved-flights';

function getSavedFlights(): SavedFlight[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveFlights(flights: SavedFlight[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flights));
}

interface SaveButtonProps {
    type: 'flight';
    title: string;
    subtitle: string;
    price: number;
    currency: string;
    imageUrl?: string;
    deepLink: string;
    snapshot: { offerId: string; provider: string };
    size?: 'sm' | 'md';
    onSavedChange?: (saved: boolean) => void;
}

export function SaveButton({
    type,
    title,
    subtitle,
    price,
    currency,
    imageUrl,
    deepLink,
    snapshot,
    size = 'md',
    onSavedChange,
}: SaveButtonProps) {
    const [isSaved, setIsSaved] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        const saved = getSavedFlights();
        const exists = saved.some((f) => f.snapshot.offerId === snapshot.offerId && f.snapshot.provider === snapshot.provider);
        setIsSaved(exists);
    }, [snapshot.offerId, snapshot.provider]);

    const toggleSave = useCallback(async () => {
        setIsLoading(true);

        const saved = getSavedFlights();
        const existsIndex = saved.findIndex(
            (f) => f.snapshot.offerId === snapshot.offerId && f.snapshot.provider === snapshot.provider
        );

        const wasSaved = existsIndex >= 0;

        if (wasSaved) {
            // Try API delete if user is logged in
            if (user) {
                try {
                    const res = await fetch(`/api/saved-trips/${saved[existsIndex].id}`, { method: 'DELETE' });
                    if (res.ok) {
                        saved.splice(existsIndex, 1);
                        setIsSaved(false);
                        onSavedChange?.(false);
                        saveFlights(saved);
                        setIsLoading(false);
                        return;
                    }
                } catch {
                    // Fall back to localStorage
                }
            }
            // LocalStorage fallback
            saved.splice(existsIndex, 1);
            setIsSaved(false);
            onSavedChange?.(false);
        } else {
            // Redirect to login if not authenticated
            if (!user) {
                router.push('/login');
                setIsLoading(false);
                return;
            }

            // Try API save if user is logged in
            const newItem: SavedFlight = {
                id: `${snapshot.provider}-${snapshot.offerId}-${Date.now()}`,
                type,
                title,
                subtitle,
                price,
                currency,
                imageUrl,
                deepLink,
                snapshot,
                savedAt: new Date().toISOString(),
            };

            try {
                const res = await fetch('/api/saved-trips', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...newItem, image_url: imageUrl, deep_link: deepLink }),
                });

                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data?.id) {
                        newItem.id = json.data.id;
                    }
                    saved.unshift(newItem);
                    setIsSaved(true);
                    onSavedChange?.(true);
                    saveFlights(saved);
                    setIsLoading(false);
                    return;
                }
            } catch {
                // Fall back to localStorage
            }

            // LocalStorage fallback
            saved.unshift(newItem);
            setIsSaved(true);
            onSavedChange?.(true);
        }

        saveFlights(saved);
        setIsLoading(false);
    }, [snapshot, type, title, subtitle, price, currency, imageUrl, deepLink, user, router, onSavedChange]);

    if (!mounted) {
        return (
            <div
                className={cn(
                    'relative flex items-center justify-center rounded-full border transition-colors',
                    size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
                )}
                aria-hidden="true"
            >
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
        );
    }

    const iconSize = size === 'sm' ? 14 : 18;
    const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

    return (
        <button
            onClick={toggleSave}
            disabled={isLoading}
            className={cn(
                'relative flex items-center justify-center rounded-full border transition-all duration-200',
                btnSize,
                isSaved
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-500 shadow-sm shadow-rose-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:text-rose-500 hover:shadow-sm'
            )}
            aria-label={isSaved ? 'Remove from saved' : 'Save flight'}
            aria-pressed={isSaved}
        >
            {isLoading ? (
                <Loader2 className={`w-${iconSize / 2} h-${iconSize / 2} animate-spin`} />
            ) : (
                <>
                    {isSaved && <HeartFill className={`w-${iconSize} h-${iconSize} fill-current`} />}
                    {!isSaved && <Heart className={`w-${iconSize} h-${iconSize}`} />}
                </>
            )}
        </button>
    );
}

export default SaveButton;