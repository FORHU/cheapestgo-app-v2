import type { MappableProperty } from '@/shared/components/map/types';
import { formatCurrency } from '@/shared/lib/format';

export type { MappableProperty };

/**
 * Builds a GeoJSON FeatureCollection from mappable properties.
 */
export const buildGeoJson = (
    properties: MappableProperty[],
    displayPrices?: Record<string, string>,
    convertedPrices?: Record<string, number>,
) => {
    return {
        type: 'FeatureCollection' as const,
        features: properties.map((p) => ({
            type: 'Feature' as const,
            id: p.id,
            properties: {
                id: p.id,
                price: p.price,
                convertedPrice: p.priceLoading ? 999_999_999 : (convertedPrices?.[p.id] ?? p.price),
                displayPrice: p.priceLoading ? '···' : (displayPrices?.[p.id] ?? formatCurrency(p.price, p.currency)),
                name: p.name,
                rating: p.rating ?? p.reviewScore,
                image: p.images?.[0] ?? p.image ?? '',
            },
            geometry: {
                type: 'Point' as const,
                coordinates: [p.coordinates.lng, p.coordinates.lat],
            },
        })),
    };
};
