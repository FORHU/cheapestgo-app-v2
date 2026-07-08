'use client';

import { useState, useEffect } from 'react';
import {
    Landmark, Trees, Utensils, Pill, ShoppingBasket, Bus, Search,
} from 'lucide-react';
import { env } from '@/shared/lib/env';
import type { PoiCategory } from '@/shared/config/map-discovery';

export interface NearbyGem {
    id: string;
    name: string;
    category: string;
    displayCategory?: string;
    rating: number | null;
    imageUrl: string;
    icon: React.ElementType;
    coordinates: { lat: number; lng: number };
    isStub: boolean;
}

interface UseNearbyGemsProps {
    coordinates?: { lat: number; lng: number };
    category: PoiCategory;
    radiusMeters?: number;
}

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

export function useNearbyGems({ coordinates, category, radiusMeters = 3000 }: UseNearbyGemsProps) {
    const [gems, setGems]       = useState<NearbyGem[]>([]);
    const [loading, setLoading] = useState(false);

    const hasCoords = !!(coordinates && coordinates.lat !== 0 && coordinates.lng !== 0);

    useEffect(() => {
        if (!hasCoords || !coordinates) return;

        const controller = new AbortController();
        const { signal } = controller;
        const apiBase = env.NEXT_PUBLIC_API_URL;

        const run = async () => {
            setLoading(true);
            setGems([]);

            try {
                // Stage 1: Google Places via V2 API proxy
                const discoverUrl = `${apiBase}/api/hotels/nearby?lat=${coordinates.lat}&lng=${coordinates.lng}&category=${category}&radius=${radiusMeters}`;
                const discoverRes  = await fetch(discoverUrl, { signal });
                const discoverData = discoverRes.ok
                    ? await discoverRes.json() as { features?: any[] }
                    : { features: [] };
                let features: any[] = discoverData.features ?? [];

                // Stage 2: Mapbox fallback when Google returns sparse results
                if (features.length < 5 && env.NEXT_PUBLIC_MAPBOX_TOKEN) {
                    const mbCats: Record<string, string[]> = {
                        all:        ['tourism', 'restaurant', 'park'],
                        restaurant: ['restaurant', 'cafe'],
                        attraction: ['park', 'museum'],
                        grocery:    ['grocery_store', 'supermarket'],
                        medical:    ['hospital', 'pharmacy'],
                        transit:    ['bus_station', 'train_station'],
                    };
                    const cats = mbCats[category] ?? ['tourism'];

                    const mbResults = await Promise.all(
                        cats.map(cat =>
                            fetch(
                                `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(cat)}?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&language=en&limit=15&proximity=${coordinates.lng},${coordinates.lat}`,
                                { signal }
                            ).then(r => r.json()).catch(() => ({ features: [] }))
                        )
                    );

                    const seen = new Set(features.map(f => f.properties?.name));
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
                                        isStub:   true,
                                    },
                                });
                            }
                        }
                    }
                }

                if (signal.aborted || features.length === 0) { setLoading(false); return; }

                const initialGems: NearbyGem[] = features.slice(0, 25).map(f => {
                    const name     = f.properties?.name ?? '';
                    const cat      = f.properties?.category ?? '';
                    const [lng, lat] = f.geometry?.coordinates ?? [0, 0];
                    const placeId  = f.properties?.place_id ?? '';
                    const photoRef = f.properties?.photoReference ?? '';

                    const qs = new URLSearchParams({ name, lat: String(lat), lng: String(lng) });
                    if (placeId)  qs.set('placeId', placeId);
                    if (cat)      qs.set('category', cat);
                    if (photoRef) qs.set('photoRef', photoRef);
                    const imageUrl = `${apiBase}/api/photos/poi?${qs.toString()}`;

                    return {
                        id:          placeId || name,
                        name,
                        category:    cat,
                        rating:      f.properties?.rating ?? null,
                        imageUrl,
                        icon:        categoryToIcon(cat),
                        coordinates: { lat, lng },
                        isStub:      f.properties?.isStub ?? f.properties?.source === 'mapbox',
                    };
                });

                setGems(initialGems);
                setLoading(false);

                // Stage 3: background enrichment for stub entries
                const limiter = pLimit(3);
                let buffer = [...initialGems];

                await Promise.all(
                    initialGems.map(gem =>
                        limiter(async () => {
                            if (signal.aborted || !gem.isStub) return;
                            try {
                                const qs = new URLSearchParams({
                                    name: gem.name,
                                    lat:  String(gem.coordinates.lat),
                                    lng:  String(gem.coordinates.lng),
                                    placeId:  gem.id,
                                    category: gem.category,
                                    full: 'true',
                                });
                                const r = await fetch(`${apiBase}/api/photos/poi?${qs.toString()}`, { signal });
                                if (!r.ok || signal.aborted) return;
                                const d = await r.json() as any;

                                const hasLowRating = d.rating !== undefined && d.rating !== null && Number(d.rating) < 3.5;
                                if (hasLowRating) {
                                    buffer = buffer.filter(g => g.id !== gem.id);
                                } else {
                                    buffer = buffer.map(g => g.id !== gem.id ? g : {
                                        ...g,
                                        rating:          d.rating ?? g.rating,
                                        displayCategory: d.category ?? g.category,
                                        isStub:          false,
                                    });
                                }
                                if (!signal.aborted) setGems([...buffer]);
                            } catch { /* enrichment failure is non-fatal */ }
                        })
                    )
                );
            } catch (e: any) {
                if (e?.name !== 'AbortError') console.error('[useNearbyGems]', e);
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };

        run();
        return () => controller.abort();
    }, [hasCoords, coordinates?.lat, coordinates?.lng, category, radiusMeters]);

    return { gems, loading };
}
