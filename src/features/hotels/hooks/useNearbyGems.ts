'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Landmark, Trees, Utensils, Pill, ShoppingBasket, Bus, Search,
} from 'lucide-react';
import { env } from '@/shared/lib/env';
import type { PoiCategory } from '@/shared/config/map-discovery';
import { isAbortError } from '@/shared/lib/error';

/**
 * A POI from either upstream — the app's own nearby endpoint or the Mapbox
 * fallback the hook falls back to when that returns too few. Everything is
 * optional because the two disagree about which fields they send.
 */
interface PoiFeature {
    type?: string;
    geometry?: { coordinates?: [number, number] };
    properties?: {
        name?: string;
        category?: string;
        place_id?: string;
        mapbox_id?: string;
        photoReference?: string;
        isStub?: boolean;
        source?: string;
        rating?: number | null;
        userRatingsTotal?: number;
        vicinity?: string;
        [key: string]: unknown;
    };
}

export interface PoiReview {
    author_name: string;
    rating: number;
    text: string;
    relative_time_description?: string;
    profile_photo_url?: string;
}

export interface PoiOpeningHours {
    open_now?: boolean;
    weekday_text?: string[];
}

/** What api-v2's `/photos/poi?full=true` answers with. */
interface PoiDetailsResponse {
    nameEn?: string | null;
    category?: string | null;
    vicinity?: string | null;
    rating?: number | string | null;
    userRatingsTotal?: number | null;
    reviews?: PoiReview[];
    phone?: string | null;
    website?: string | null;
    openingHours?: PoiOpeningHours | null;
}

export interface NearbyGem {
    id: string;
    /** Google's place id. Set only for places that came from Google — a Mapbox id is not one. */
    placeId?: string;
    name: string;
    /** Google's English name for the place, when it differs from the local one. */
    translatedName?: string;
    category: string;
    displayCategory?: string;
    rating: number | null;
    userRatingsTotal?: number | null;
    vicinity?: string | null;
    reviews?: PoiReview[];
    phone?: string | null;
    website?: string | null;
    openingHours?: PoiOpeningHours | null;
    source?: string;
    imageUrl: string;
    icon: React.ElementType;
    coordinates: { lat: number; lng: number };
    /** Still waiting on its details. */
    isStub: boolean;
}

interface UseNearbyGemsProps {
    coordinates?: { lat: number; lng: number };
    category: PoiCategory;
    radiusMeters?: number;
}

/** Below this, a place is dropped once its details arrive (v1's bar). */
const MIN_RATING = 3.5;
/** Enrichment publishes at most this often, plus once at the end — not once per place. */
const FLUSH_MS = 800;

const pLimit = (limit: number) => {
    let active = 0;
    const queue: (() => void)[] = [];
    const next = () => { if (queue.length > 0 && active < limit) { active++; queue.shift()!(); } };
    return <T,>(fn: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const run = () => fn().then(resolve, reject).finally(() => { active--; next(); });
            queue.push(run);
            next();
        });
};

export function categoryToIcon(cat: string) {
    const c = cat.toLowerCase();
    if (c.includes('restaurant') || c.includes('cafe') || c.includes('food') || c.includes('bar')) return Utensils;
    if (c.includes('park') || c.includes('garden') || c.includes('nature')) return Trees;
    if (c.includes('hospital') || c.includes('pharmacy') || c.includes('medical')) return Pill;
    if (c.includes('supermarket') || c.includes('grocery') || c.includes('shop')) return ShoppingBasket;
    if (c.includes('bus') || c.includes('station') || c.includes('transit')) return Bus;
    if (c.includes('museum') || c.includes('attraction') || c.includes('landmark')) return Landmark;
    return Search;
}

export function categoryToBg(cat: string) {
    const c = cat.toLowerCase();
    if (c.includes('park') || c.includes('garden') || c.includes('nature')) return 'from-emerald-800 to-emerald-950';
    if (c.includes('restaurant') || c.includes('cafe') || c.includes('food') || c.includes('bar')) return 'from-orange-700 to-orange-950';
    if (c.includes('museum') || c.includes('tourist') || c.includes('landmark') || c.includes('attraction')) return 'from-indigo-700 to-indigo-950';
    if (c.includes('shop') || c.includes('market') || c.includes('supermarket')) return 'from-pink-700 to-pink-950';
    if (c.includes('transit') || c.includes('station') || c.includes('bus') || c.includes('train')) return 'from-slate-600 to-slate-900';
    if (c.includes('hospital') || c.includes('pharmacy') || c.includes('medical')) return 'from-blue-700 to-blue-950';
    return 'from-slate-700 to-slate-950';
}

function toGem(f: PoiFeature, apiBase: string): NearbyGem {
    const name = f.properties?.name ?? '';
    const category = f.properties?.category ?? '';
    const [lng, lat] = f.geometry?.coordinates ?? [0, 0];
    const source = f.properties?.source ?? 'mapbox';
    const placeId = source === 'google' ? f.properties?.place_id : undefined;
    const photoRef = f.properties?.photoReference ?? '';

    const qs = new URLSearchParams({ name, lat: String(lat), lng: String(lng) });
    if (placeId)  qs.set('placeId', placeId);
    if (category) qs.set('category', category);
    if (photoRef) qs.set('photo_reference', photoRef);

    return {
        id:               f.properties?.place_id || name,
        placeId,
        name,
        category,
        rating:           f.properties?.rating ?? null,
        userRatingsTotal: typeof f.properties?.userRatingsTotal === 'number' ? f.properties.userRatingsTotal : null,
        vicinity:         typeof f.properties?.vicinity === 'string' ? f.properties.vicinity : null,
        source,
        imageUrl:         `${apiBase}/photos/poi?${qs.toString()}`,
        icon:             categoryToIcon(category),
        coordinates:      { lat, lng },
        isStub:           true,
    };
}

/** One place's details folded into the list — or the place dropped, if they rate it too low. */
export function mergeDetails(gems: NearbyGem[], id: string, d: PoiDetailsResponse): NearbyGem[] {
    // The endpoint sends this as a string sometimes; coerce once, here.
    const rating = d.rating != null ? Number(d.rating) : null;
    if (rating !== null && rating < MIN_RATING) return gems.filter((g) => g.id !== id);
    return gems.map((g) => g.id !== id ? g : {
        ...g,
        translatedName:   d.nameEn ?? g.translatedName,
        displayCategory:  d.category ?? g.displayCategory,
        vicinity:         d.vicinity ?? g.vicinity,
        rating:           rating ?? g.rating,
        userRatingsTotal: d.userRatingsTotal ?? g.userRatingsTotal,
        reviews:          d.reviews?.length ? d.reviews : g.reviews,
        phone:            d.phone ?? g.phone,
        website:          d.website ?? g.website,
        openingHours:     d.openingHours ?? g.openingHours,
        isStub:           false,
    });
}

async function enrich(
    initial: NearbyGem[],
    apiBase: string,
    signal: AbortSignal,
    publish: (gems: NearbyGem[]) => void,
) {
    const limiter = pLimit(3);
    let buffer = [...initial];
    let lastFlush = Date.now();
    const flush = (force: boolean) => {
        if (signal.aborted) return;
        if (force || Date.now() - lastFlush >= FLUSH_MS) {
            publish([...buffer]);
            lastFlush = Date.now();
        }
    };

    await Promise.all(initial.map((gem) => limiter(async () => {
        if (signal.aborted) return;
        try {
            const qs = new URLSearchParams({
                name: gem.name,
                lat:  String(gem.coordinates.lat),
                lng:  String(gem.coordinates.lng),
                full: 'true',
            });
            if (gem.placeId)  qs.set('placeId', gem.placeId);
            if (gem.category) qs.set('category', gem.category);
            const res = await fetch(`${apiBase}/photos/poi?${qs.toString()}`, { signal });
            if (!res.ok) return;
            buffer = mergeDetails(buffer, gem.id, await res.json() as PoiDetailsResponse);
            flush(false);
        } catch {
            /* one place's details failing leaves its card as it was */
        }
    })));
    flush(true);
}

export function useNearbyGems({ coordinates, category, radiusMeters = 3000 }: UseNearbyGemsProps) {
    const [gems, setGems]       = useState<NearbyGem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(false);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    // Callers build `coordinates` inline, so the effect keys off the two
    // primitives instead of the object — depending on its identity would
    // refetch on every render.
    const lat = coordinates?.lat;
    const lng = coordinates?.lng;

    useEffect(() => {
        if (!lat || !lng) return;

        const controller = new AbortController();
        const { signal } = controller;
        const apiBase = env.NEXT_PUBLIC_API_URL;

        const run = async () => {
            setLoading(true);
            setError(false);
            setGems([]);

            try {
                // Stage 1: Google Places via the V2 API. A failure here is reported, not
                // presented as an empty neighbourhood — but Stage 2 still runs, so whatever
                // Mapbox has still shows.
                let features: PoiFeature[] = [];
                try {
                    const res = await fetch(
                        `${apiBase}/hotels/nearby?lat=${lat}&lng=${lng}&category=${category}&radius=${radiusMeters}`,
                        { signal },
                    );
                    if (res.ok) features = ((await res.json()) as { features?: PoiFeature[] }).features ?? [];
                    else if (!signal.aborted) setError(true);
                } catch (e) {
                    if (isAbortError(e)) return;
                    setError(true);
                }

                // Stage 2: Mapbox fallback when Google returns sparse results
                if (features.length < 5 && env.NEXT_PUBLIC_MAPBOX_TOKEN) {
                    const mbCats: Record<string, string[]> = {
                        all:        ['tourism', 'restaurant', 'park'],
                        restaurant: ['restaurant', 'cafe'],
                        cafe:       ['coffee', 'cafe'],
                        attraction: ['park', 'museum'],
                        grocery:    ['grocery_store', 'supermarket'],
                        medical:    ['hospital', 'pharmacy'],
                        transit:    ['bus_station', 'train_station'],
                    };
                    const cats = mbCats[category] ?? ['tourism'];

                    const mbResults = await Promise.all(
                        cats.map((cat) =>
                            fetch(
                                `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(cat)}?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&language=en&limit=15&proximity=${lng},${lat}`,
                                { signal },
                            ).then((r) => r.json()).catch(() => ({ features: [] })),
                        ),
                    );

                    const seen = new Set(features.map((f) => f.properties?.name));
                    for (const mb of mbResults) {
                        for (const f of (mb.features ?? [])) {
                            const name = f.properties?.name;
                            if (name && !seen.has(name)) {
                                seen.add(name);
                                features.push({
                                    type: 'Feature',
                                    geometry: f.geometry,
                                    properties: {
                                        name,
                                        place_id: f.properties?.mapbox_id ?? name,
                                        category: f.properties?.category ?? category,
                                        rating:   null,
                                        source:   'mapbox',
                                    },
                                });
                            }
                        }
                    }
                }

                if (signal.aborted) return;
                if (features.length === 0) { setLoading(false); return; }

                const initialGems = features.slice(0, 25).map((f) => toGem(f, apiBase));
                setGems(initialGems);
                setLoading(false);

                // Stage 3: details for every place, published in batches
                await enrich(initialGems, apiBase, signal, setGems);
            } catch (e) {
                if (!isAbortError(e)) {
                    console.error('[useNearbyGems]', e);
                    setError(true);
                }
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };

        run();
        return () => controller.abort();
    }, [lat, lng, category, radiusMeters, attempt]);

    return { gems, loading, error, retry };
}
