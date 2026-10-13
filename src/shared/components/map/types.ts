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

/**
 * A property as the search API sends it, before `toMappable` normalises it.
 *
 * Every field is optional and several are alternates — `lat` / `latitude` /
 * `coordinates.lat` are one value under three spellings, because the search
 * endpoint, the price stream and the suggest endpoint disagree. This documents
 * the spellings the adapter actually handles rather than claiming a contract
 * the API does not promise.
 */
export interface ApiHotel {
    id?: string;
    hotelId?: string;
    name?: string;
    /** A number from the search endpoint, a string from some price payloads. */
    price?: number | string;
    currency?: string;
    /**
     * Numbers from most endpoints, strings from a few — `toMappable` coerces
     * with `Number()`, and `search-map.test.ts` pins that behaviour with a case
     * that passes them as strings.
     */
    lat?: number | string;
    latitude?: number | string;
    lng?: number | string;
    longitude?: number | string;
    coordinates?: { lat?: number | string; lng?: number | string };
    images?: string[];
    thumbnailUrl?: string;
    image?: string;
    rating?: number;
    reviewScore?: number;
    reviewRating?: number;
    reviewCount?: number;
    reviews?: number;
    refundableTag?: string;
    starRating?: number;
    location?: string;
    city?: string;
    country?: string;
    boardType?: string;
    priceLoading?: boolean;
    originalPrice?: number;
}
