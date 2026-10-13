import React, { useRef, useState, useCallback } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';

export const useMapboxInstance = () => {
    const mapRef = useRef<MapRef>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [isMapIdle, setIsMapIdle] = useState(false);

    const handleMapLoad = useCallback(() => {
        setIsMapLoaded(true);
    }, []);

    React.useEffect(() => {
        if (mapRef.current?.getMap()?.loaded()) {
            setIsMapLoaded(true);
        }
    }, []);

    // Gate on the map's first `idle` event so hotel pins only appear after
    // tiles are fully rendered (not on the light-blue loading background).
    React.useEffect(() => {
        if (!isMapLoaded) {
            setIsMapIdle(false);
            return;
        }
        const map = mapRef.current?.getMap();
        if (!map) return;

        // Already idle (e.g. cached tiles on Fast Refresh)
        if (map.areTilesLoaded?.()) {
            setIsMapIdle(true);
            return;
        }

        const onIdle = () => setIsMapIdle(true);
        map.once('idle', onIdle);
        return () => { map.off('idle', onIdle); };
    }, [isMapLoaded]);

    const handleMapStyleChange = useCallback(() => {
        setIsMapLoaded(false);
        setIsMapIdle(false);
    }, []);

    return {
        mapRef,
        isMapLoaded,
        isMapIdle,
        handleMapLoad,
        handleMapStyleChange,
    };
};
