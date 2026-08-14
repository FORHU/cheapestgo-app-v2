import type { MappableProperty } from '@/shared/components/map/types';
import type { SortValue } from '@/features/search/types/search.types';

export function toMappable(h: Record<string, unknown>): MappableProperty | null {
    const lat = (h.lat ?? (h as Record<string, unknown>).latitude ?? (h.coordinates as Record<string, unknown> | undefined)?.lat) as number | undefined;
    const lng = (h.lng ?? (h as Record<string, unknown>).longitude ?? (h.coordinates as Record<string, unknown> | undefined)?.lng) as number | undefined;
    if (!lat || !lng) return null;
    const images = (h.images as string[] | undefined) ?? [];
    return {
        id:            (h.id ?? h.hotelId) as string,
        name:          h.name as string,
        price:         typeof h.price === 'number' ? h.price : parseFloat((h.price as string) ?? '0'),
        currency:      (h.currency as string) ?? 'USD',
        coordinates:   { lat: Number(lat), lng: Number(lng) },
        images:        images.length ? images : (h.thumbnailUrl ? [h.thumbnailUrl as string] : []),
        image:         (images[0] ?? h.thumbnailUrl ?? h.image ?? undefined) as string | undefined,
        rating:        (h.reviewScore ?? h.reviewRating ?? h.rating) as number | undefined,
        reviewScore:   (h.reviewScore ?? h.reviewRating) as number | undefined,
        reviewCount:   (h.reviewCount ?? h.reviews) as number | undefined,
        refundableTag: h.refundableTag as string | undefined,
        starRating:    h.starRating as number | undefined,
        location:      h.location as string | undefined,
        city:          h.city as string | undefined,
        country:       h.country as string | undefined,
        boardType:     h.boardType as string | undefined,
        priceLoading:  h.priceLoading as boolean | undefined,
        originalPrice: h.originalPrice as number | undefined,
    };
}

export function sortHotels(list: MappableProperty[], by: SortValue): MappableProperty[] {
    const c = [...list];
    if (by === 'price-low')     c.sort((a, b) => a.price - b.price);
    if (by === 'price-high')    c.sort((a, b) => b.price - a.price);
    if (by === 'rating')        c.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (by === 'most-reviewed') c.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return c;
}

export function fmtPill(destination: string, checkIn: string, checkOut: string, adults: string, children: string): string {
    const parts: string[] = [];
    if (destination) parts.push(destination);
    if (checkIn && checkOut) {
        const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        parts.push(`${fmt(checkIn)} – ${fmt(checkOut)}`);
    }
    const guests = (Number(adults) || 2) + (Number(children) || 0);
    parts.push(`${guests} guest${guests !== 1 ? 's' : ''}`);
    return parts.join(' | ');
}
