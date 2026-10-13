import { useState, useEffect } from 'react';
import { env } from '@/shared/lib/env';
import { isAbortError } from '@/shared/lib/error';

/** One row of the nearby-places GeoJSON, as this hook reads it. */
interface PlaceFeature {
    properties: {
        name: string;
        category?: string;
        rating?: number;
        userRatingsTotal?: number;
        place_id?: string;
        vicinity?: string;
    };
    geometry: { coordinates: [number, number] };
}

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

    // Keyed off the primitives, not the object: callers pass `coordinates`
    // inline, so depending on its identity would refetch every render.
    const lat = coordinates?.lat;
    const lng = coordinates?.lng;

    useEffect(() => {
        if (!enabled || lat === undefined || lng === undefined) {
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
                    `${env.NEXT_PUBLIC_API_URL}/hotels/nearby?lat=${lat}&lng=${lng}&category=${category}&radius=${radiusMeters}`,
                    { signal }
                );
                if (!res.ok || signal.aborted) return;
                const data = await res.json();
                const mapped: NearbyPlace[] = (data.features || []).map((f: PlaceFeature) => ({
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
            } catch (e) {
                if (!isAbortError(e)) console.error('[MapNearbyPlaces]', e);
            } finally {
                if (!signal.aborted) setIsLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [enabled, lat, lng, radiusMeters, category]);

    return { places, isLoading };
}
