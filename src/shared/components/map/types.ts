/** A property with guaranteed coordinates (filtered before passing to map) */
export interface MappableProperty {
    id: string;
    name: string;
    price: number;
    currency: string;
    coordinates: { lat: number; lng: number };
    images?: string[];
    /** Convenience alias for images[0] */
    image?: string;
    /** 0–10 review/rating score */
    rating?: number;
    reviewScore?: number;
    reviewCount?: number;
    refundableTag?: string;
    originalPrice?: number;
    /** True while streaming price data */
    priceLoading?: boolean;
    starRating?: number;
    location?: string;
    city?: string;
    country?: string;
    boardType?: string;
}

/** Props shared across map components for selection sync */
export interface MapSelectionProps {
    selectedId: string | null;
    hoveredId: string | null;
    onSelect: (id: string | null) => void;
    onHover: (id: string | null) => void;
}

/** Bounds computed from property coordinates */
export interface MapBounds {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    centerLat: number;
    centerLng: number;
}

/** Compute map bounds from a list of properties */
export function computeBounds(properties: MappableProperty[]): MapBounds {
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
