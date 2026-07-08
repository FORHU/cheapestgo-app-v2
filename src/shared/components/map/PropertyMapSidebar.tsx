'use client';

import React, { useRef, useState, useCallback } from 'react';
import { NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import { Map } from '@/shared/components/ui/map';
import { MapMarker } from './MapMarker';
import type { MappableProperty } from './types';

interface PropertyMapSidebarProps {
    property: {
        id: string;
        name: string;
        coordinates: { lat: number; lng: number };
        price?: number;
        currency?: string;
    };
    className?: string;
}

/**
 * A simple sidebar map showing a single hotel location pin.
 * Used on the property detail page.
 */
export function PropertyMapSidebar({ property, className }: PropertyMapSidebarProps) {
    const mapRef = useRef<MapRef>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const handleLoad = useCallback(() => setIsLoaded(true), []);

    const { lat, lng } = property.coordinates;

    // Build a minimal MappableProperty for the MapMarker
    const mappable: MappableProperty = {
        id: property.id,
        name: property.name,
        price: property.price ?? 0,
        currency: property.currency ?? 'USD',
        coordinates: property.coordinates,
    };

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    return (
        <div className={className ?? 'w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-white/10'}>
            <div className="relative w-full h-full min-h-[220px]">
                <Map
                    ref={mapRef}
                    mapStyle="mapbox://styles/mapbox/streets-v12?optimize=true"
                    initialViewState={{
                        longitude: lng,
                        latitude: lat,
                        zoom: 14,
                        pitch: 20,
                        bearing: 0,
                    }}
                    maxPitch={60}
                    onLoad={handleLoad}
                    className="rounded-xl"
                >
                    <NavigationControl position="top-right" showCompass={false} />

                    {isLoaded && (
                        <MapMarker
                            property={mappable}
                            isSelected={true}
                            isHovered={false}
                            onClick={() => {}}
                            onHover={() => {}}
                        />
                    )}
                </Map>

                {/* "Open in Google Maps" link */}
                <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors"
                >
                    <MapPin size={11} />
                    Open in Maps
                </a>
            </div>
        </div>
    );
}
