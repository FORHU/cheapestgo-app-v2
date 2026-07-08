import { useEffect, useMemo, useRef } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import { getBoundsFromProperties } from '../utils/getBoundsFromProperties';
import type { MappableProperty } from '@/shared/components/map/types';

interface UseMapViewportProps {
    mapRef: React.RefObject<MapRef | null>;
    isMapLoaded: boolean;
    properties: MappableProperty[];
    selectedId?: string | null;
    /** When true, skip the flyTo animation when a property is selected. */
    disableFlyToSelected?: boolean;
}

export const useMapViewport = ({
    mapRef,
    isMapLoaded,
    properties,
    selectedId,
    disableFlyToSelected = false,
}: UseMapViewportProps) => {
    const propertiesKey = useMemo(() => properties.map(p => p.id).join(','), [properties]);
    const hasFittedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isMapLoaded || properties.length === 0) return;
        if (selectedId) return;
        if (hasFittedRef.current === propertiesKey) return;

        const map = mapRef.current;
        if (!map) return;

        const bounds = getBoundsFromProperties(properties);
        hasFittedRef.current = propertiesKey;

        if (properties.length === 1) {
            map.flyTo({
                center: [bounds.centerLng, bounds.centerLat],
                zoom: 15, pitch: 45, bearing: -10, duration: 1000,
            });
            return;
        }

        map.fitBounds(
            [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
            { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 16, duration: 1000, pitch: 45, bearing: -10 }
        );
    }, [isMapLoaded, propertiesKey, mapRef, selectedId]);

    useEffect(() => {
        if (!isMapLoaded || !selectedId || disableFlyToSelected) return;
        const map = mapRef.current;
        if (!map) return;
        const selectedProperty = properties.find((p) => p.id === selectedId);
        if (selectedProperty?.coordinates) {
            map.flyTo({
                center: [selectedProperty.coordinates.lng, selectedProperty.coordinates.lat],
                zoom: 16, pitch: 45, bearing: -20, duration: 800, essential: true
            });
        }
    }, [isMapLoaded, selectedId, properties, mapRef, disableFlyToSelected]);
};
