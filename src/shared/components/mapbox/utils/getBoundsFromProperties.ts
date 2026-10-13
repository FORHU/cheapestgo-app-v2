import type { MappableProperty } from '@/shared/components/map/types';

export interface MapBounds {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    centerLat: number;
    centerLng: number;
}

export function getBoundsFromProperties(properties: MappableProperty[]): MapBounds {
    if (properties.length === 0) {
        return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0, centerLat: 0, centerLng: 0 };
    }

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

    for (const p of properties) {
        if (p.coordinates.lat < minLat) minLat = p.coordinates.lat;
        if (p.coordinates.lat > maxLat) maxLat = p.coordinates.lat;
        if (p.coordinates.lng < minLng) minLng = p.coordinates.lng;
        if (p.coordinates.lng > maxLng) maxLng = p.coordinates.lng;
    }

    return {
        minLat, maxLat, minLng, maxLng,
        centerLat: (minLat + maxLat) / 2,
        centerLng: (minLng + maxLng) / 2,
    };
}
