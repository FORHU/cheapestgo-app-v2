'use client';

import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { formatCurrency } from '@/shared/lib/format';
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
    const isActive = isSelected || isHovered;
    const image = property.image ?? property.images?.[0];
    const borderColor = isSelected ? '#3b82f6' : isHovered ? '#93c5fd' : 'white';
    const shadow = isActive ? '0 4px 14px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.25)';

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
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 150ms ease',
                }}
            >
                {/* Circular hotel image */}
                <div style={{
                    width: 48,
                    height: 48,
                    minWidth: 48,
                    minHeight: 48,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2.5px solid ${borderColor}`,
                    boxShadow: shadow,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}>
                    {image && (
                        <img
                            src={image}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    )}
                </div>

                {/* Price / loading label */}
                <div style={{
                    marginTop: 3,
                    background: isSelected ? '#3b82f6' : 'white',
                    color: isSelected ? 'white' : '#111',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.18)',
                    lineHeight: '1.5',
                    minWidth: 32,
                    textAlign: 'center',
                }}>
                    {property.priceLoading || !priceLabel ? (
                        <span style={{ letterSpacing: '0.2em', color: '#999' }}>···</span>
                    ) : priceLabel}
                </div>
            </div>
        </Marker>
    );
});

export { MapMarker };
export type { MapMarkerProps };
