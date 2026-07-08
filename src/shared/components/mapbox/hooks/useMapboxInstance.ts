import React, { useRef, useState, useCallback } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';

export const useMapboxInstance = () => {
    const mapRef = useRef<MapRef>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    const handleMapLoad = useCallback(() => {
        setIsMapLoaded(true);
    }, []);

    React.useEffect(() => {
        if (mapRef.current?.getMap()?.loaded()) {
            setIsMapLoaded(true);
        }
    }, []);

    const handleMapStyleChange = useCallback(() => {
        setIsMapLoaded(false);
    }, []);

    return {
        mapRef,
        isMapLoaded,
        handleMapLoad,
        handleMapStyleChange,
    };
};
