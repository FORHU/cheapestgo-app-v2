import { useState, useEffect } from 'react';

export interface NearbyPlace {
    name: string;
    category: string;
    lat: number;
    lng: number;
    rating?: number;
    userRatingsTotal?: number;
    placeId?: string;
    vicinity?: string;
}

interface UseMapNearbyPlacesOptions {
    coordinates: { lat: number; lng: number } | null;
    radiusMeters: number;
    category: string;
    enabled: boolean;
}

export function useMapNearbyPlaces({
    coordinates,
    radiusMeters,
    category,
    enabled,
}: UseMapNearbyPlacesOptions) {
    const [places, setPlaces] = useState<NearbyPlace[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !coordinates) {
            setPlaces([]);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        const { signal } = controller;

        const load = async () => {
            setIsLoading(true);
            setPlaces([]);
            try {
                const res = await fetch(
                    `/api/places/discover?lat=${coordinates.lat}&lng=${coordinates.lng}&category=${category}&radius=${radiusMeters}`,
                    { signal }
                );
                if (!res.ok || signal.aborted) return;
                const data = await res.json();
                const mapped: NearbyPlace[] = (data.features || []).map((f: any) => ({
                    name: f.properties.name,
                    category: f.properties.category || 'place',
                    lat: f.geometry.coordinates[1],
                    lng: f.geometry.coordinates[0],
                    rating: f.properties.rating,
                    userRatingsTotal: f.properties.userRatingsTotal,
                    placeId: f.properties.place_id,
                    vicinity: f.properties.vicinity,
                }));
                if (!signal.aborted) setPlaces(mapped);
            } catch (e: any) {
                if (e.name !== 'AbortError') console.error('[MapNearbyPlaces]', e);
            } finally {
                if (!signal.aborted) setIsLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [enabled, coordinates?.lat, coordinates?.lng, radiusMeters, category]);

    return { places, isLoading };
}
