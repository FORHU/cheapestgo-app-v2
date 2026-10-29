'use client';

import React, { useCallback, useMemo } from 'react';
import { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox';
import { Map as MapView, type StandardStyleConfig } from '@/shared/components/ui/map';
import { NearbyPlaceMarker } from '@/shared/components/map/NearbyPlaceMarker';
import type { NearbyPlace } from '@/shared/components/map/useMapNearbyPlaces';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { BRAND, BRAND_STOPS } from '@/shared/lib/palette';
import type { LatLng } from './types';

export interface NearbyMapProps {
    mapRef: React.RefObject<MapRef | null>;
    hotel: LatLng;
    hotelLabel: string;
    places: NearbyGem[];
    activeId: string | null;
    onSelect: (gem: NearbyGem) => void;
    mapStyle: string;
    standardConfig?: StandardStyleConfig;
    route: GeoJSON.LineString | null;
    /** Where a "directions to the hotel" route starts. */
    origin?: (LatLng & { name: string }) | null;
    height: number | string;
    /** Drawn over the map: the callout, the controls, the weather. */
    children?: React.ReactNode;
}

function toPlace(gem: NearbyGem): NearbyPlace {
    return {
        name: gem.name,
        category: gem.category || 'place',
        lat: gem.coordinates.lat,
        lng: gem.coordinates.lng,
        rating: gem.rating ?? undefined,
        placeId: gem.id,
    };
}

export function NearbyMap({
    mapRef, hotel, hotelLabel, places, activeId, onSelect, mapStyle, standardConfig, route, origin, height, children,
}: NearbyMapProps) {
    const byId = useMemo(() => new globalThis.Map(places.map((g) => [g.id, g])), [places]);
    const handleMarker = useCallback((place: NearbyPlace) => {
        const gem = place.placeId ? byId.get(place.placeId) : undefined;
        if (gem) onSelect(gem);
    }, [byId, onSelect]);

    const routeData = useMemo(
        () => (route ? { type: 'Feature' as const, properties: {}, geometry: route } : null),
        [route],
    );

    return (
        // Square, and lifted by the same short shadow as the room cards beside it.
        <div
            className="shadow-[0_4px_10px_-2px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_-6px_rgba(0,0,0,0.85),0_1px_3px_rgba(0,0,0,0.6)]"
            style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: '#1e293b' }}
        >
            <MapView
                ref={mapRef as React.RefObject<MapRef>}
                mapStyle={mapStyle}
                standardConfig={standardConfig}
                initialViewState={{ longitude: hotel.lng, latitude: hotel.lat, zoom: 14 }}
                scrollZoom={false}
                className="h-full w-full"
            >
                {routeData && (
                    <Source id="nearby-route" type="geojson" data={routeData}>
                        <Layer
                            id="nearby-route-line"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={{ 'line-color': BRAND_STOPS.from, 'line-width': 5, 'line-opacity': 0.85 }}
                        />
                    </Source>
                )}
                <Marker longitude={hotel.lng} latitude={hotel.lat} anchor="center" style={{ zIndex: 30 }}>
                    <div role="img" aria-label={hotelLabel} style={{ width: 18, height: 18, borderRadius: '50%', background: BRAND.gradient, border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.55)' }} />
                </Marker>
                {origin && (
                    <Marker longitude={origin.lng} latitude={origin.lat} anchor="center" style={{ zIndex: 30 }}>
                        <div role="img" aria-label={origin.name} style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', border: `4px solid ${BRAND_STOPS.from}`, boxShadow: '0 2px 6px rgba(0,0,0,.4)' }} />
                    </Marker>
                )}
                {places.map((gem, i) => (
                    <NearbyPlaceMarker key={gem.id} place={toPlace(gem)} isSelected={gem.id === activeId} onClick={handleMarker} index={i} />
                ))}
            </MapView>
            {children}
        </div>
    );
}
