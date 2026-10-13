'use client';

import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { formatCurrency } from '@/shared/lib/format';
import { HotelPin } from './HotelPin';
import type { MappableProperty } from './types';

interface MapMarkerProps {
    property: MappableProperty;
    displayPrice?: number;
    displayCurrency?: string;
    isSelected: boolean;
    isHovered: boolean;
    onClick: (id: string) => void;
    onHover: (id: string | null) => void;
    index?: number;
}

const MapMarker = React.memo(function MapMarker({
    property,
    displayPrice,
    displayCurrency,
    isSelected,
    isHovered,
    onClick,
    onHover,
}: MapMarkerProps) {
    const image = property.image ?? property.images?.[0];

    let priceLabel: string;
    try {
        priceLabel = property.priceLoading
            ? ''
            : formatCurrency(displayPrice ?? property.price, displayCurrency ?? property.currency ?? 'USD');
    } catch {
        priceLabel = '';
    }

    return (
        <Marker
            latitude={property.coordinates.lat}
            longitude={property.coordinates.lng}
            // Bottom-anchored so the pin's tail lands on the coordinate. The
            // popup offsets in MapPopup are measured from this same edge.
            anchor="bottom"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick(property.id);
            }}
            style={{
                zIndex: isSelected ? 20 : isHovered ? 10 : 1,
                cursor: 'pointer',
            }}
        >
            <div
                onMouseEnter={() => onHover(property.id)}
                onMouseLeave={() => onHover(null)}
            >
                <HotelPin
                    image={image}
                    priceLabel={priceLabel}
                    active={isHovered}
                    selected={isSelected}
                />
            </div>
        </Marker>
    );
});

export { MapMarker };
export type { MapMarkerProps };
