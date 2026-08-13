import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import type { MappableProperty } from '@/shared/components/map/types';

interface UseMapViewportProps {
    mapRef: React.RefObject<MapRef | null>;
    isMapLoaded: boolean;
    properties: MappableProperty[];
    center?: { lat: number; lng: number };
    selectedId?: string | null;
    disableFlyToSelected?: boolean;
    skipInitialFit?: boolean;
}

export const useMapViewport = ({
    mapRef,
    isMapLoaded,
    properties,
    center,
    selectedId,
    disableFlyToSelected = false,
    skipInitialFit = false,
}: UseMapViewportProps) => {
    const hasFittedRef = useRef<boolean>(false);

    // Reset when a new search clears properties
    useEffect(() => {
        if (properties.length === 0) hasFittedRef.current = false;
    }, [properties.length]);

    // Initial fly-to once ≥5 hotels have arrived and the map is ready
    useEffect(() => {
        if (skipInitialFit) return; // district bbox controls initial fit instead
        if (!isMapLoaded || properties.length < 5) return;
        if (hasFittedRef.current) return;
        if (selectedId) return;

        hasFittedRef.current = true;

        const map = mapRef.current;
        if (!map) return;

        if (center) {
            // Fly to the search city center at a fixed zoom — predictable, avoids
            // fitBounds zooming out to show outlier hotels in the Gulf of Thailand.
            map.flyTo({ center: [center.lng, center.lat], zoom: 12, duration: 800 });
            return;
        }

        // No explicit center (non-city searches) — fit to the property cluster
        if (properties.length === 1) {
            const { lat, lng } = properties[0].coordinates;
            map.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });
            return;
        }

        const lats = properties.map(p => p.coordinates.lat).sort((a, b) => a - b);
        const lngs = properties.map(p => p.coordinates.lng).sort((a, b) => a - b);
        const lo = Math.floor(properties.length * 0.20);
        const hi = Math.ceil(properties.length * 0.80) - 1;
        map.fitBounds(
            [[lngs[lo], lats[lo]], [lngs[hi], lats[hi]]],
            { padding: 80, maxZoom: 13, duration: 800, pitch: 0, bearing: 0 }
        );
    }, [isMapLoaded, properties.length, mapRef, center, selectedId, skipInitialFit]);

    // flyTo selected (only when disableFlyToSelected is false)
    useEffect(() => {
        if (!isMapLoaded || !selectedId || disableFlyToSelected) return;
        const map = mapRef.current;
        if (!map) return;
        const prop = properties.find(p => p.id === selectedId);
        if (prop?.coordinates) {
            map.flyTo({
                center: [prop.coordinates.lng, prop.coordinates.lat],
                zoom: 15, duration: 800, essential: true,
            });
        }
    }, [isMapLoaded, selectedId, properties, mapRef, disableFlyToSelected]);
};
