'use client';

import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { Utensils, Trees, Landmark, ShoppingBasket, Pill, Bus } from 'lucide-react';
import type { NearbyPlace } from './useMapNearbyPlaces';

function getCategoryConfig(category: string) {
    const cat = category.toLowerCase();
    if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food') ||
        cat.includes('bar') || cat.includes('bakery')) return { Icon: Utensils };
    if (cat.includes('park') || cat.includes('garden') || cat.includes('nature'))
        return { Icon: Trees };
    if (cat.includes('museum') || cat.includes('tourist') || cat.includes('attraction') ||
        cat.includes('art') || cat.includes('zoo') || cat.includes('amusement') || cat.includes('aquarium'))
        return { Icon: Landmark };
    if (cat.includes('supermarket') || cat.includes('grocery') || cat.includes('convenience'))
        return { Icon: ShoppingBasket };
    if (cat.includes('hospital') || cat.includes('pharmacy') || cat.includes('medical') ||
        cat.includes('doctor') || cat.includes('dentist'))
        return { Icon: Pill };
    if (cat.includes('bus') || cat.includes('train') || cat.includes('station') ||
        cat.includes('transit') || cat.includes('subway') || cat.includes('airport'))
        return { Icon: Bus };
    return { Icon: Landmark };
}

interface NearbyPlaceMarkerProps {
    place: NearbyPlace;
    isSelected: boolean;
    onClick: (place: NearbyPlace) => void;
}

const NearbyPlaceMarker = React.memo(function NearbyPlaceMarker({
    place,
    isSelected,
    onClick,
}: NearbyPlaceMarkerProps) {
    const { Icon } = getCategoryConfig(place.category);

    return (
        <Marker
            latitude={place.lat}
            longitude={place.lng}
            anchor="center"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick(place);
            }}
            style={{ zIndex: isSelected ? 25 : 5, cursor: 'pointer' }}
        >
            <div
                className={`flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 shadow-md border-2 border-white transition-transform ${
                    isSelected ? 'scale-125' : 'hover:scale-110'
                }`}
            >
                <Icon className="w-2.5 h-2.5 text-white" />
            </div>
        </Marker>
    );
});

export { NearbyPlaceMarker };
