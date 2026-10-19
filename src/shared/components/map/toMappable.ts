import type { ApiHotel, MappableProperty } from './types';

/**
 * Normalise one hotel as the search stream sends it into the shape the list and
 * the map both read.
 *
 * It lives here rather than inside the search page so it can be tested directly.
 * The test used to hold its own copy of this function, which is how the bug
 * below survived: the copy was asserted, the real one was not, and the suite
 * stayed green while the page showed nothing.
 */
export function toMappable(h: ApiHotel): MappableProperty | null {
    const id = (h.id ?? h.hotelId) as string | undefined;
    if (!id) return null;

    // The search leg answers before content is resolved — when the supplier
    // portfolio comes back empty it sends 0 for both coordinates and the hotel
    // code as the name, then fills both in a later `content` event.
    //
    // `if (!lat || !lng) return null` dropped every one of those rows, because 0
    // is falsy. That emptied the list and the map together: nothing reached
    // state, so the content event carrying the real names and positions had
    // nothing left to patch. Unplaced rows are kept at 0,0 and the patch moves
    // them; SearchMapContainer already skips 0,0 when placing pins, so the map
    // simply fills in as the coordinates arrive.
    const lat = Number(h.lat ?? h.latitude ?? h.coordinates?.lat ?? 0) || 0;
    const lng = Number(h.lng ?? h.longitude ?? h.coordinates?.lng ?? 0) || 0;

    return {
        id,
        name: h.name as string,
        price: typeof h.price === 'number' ? h.price : parseFloat(h.price ?? '0'),
        currency: h.currency ?? 'USD',
        coordinates: { lat, lng },
        images: h.images?.length ? h.images : h.thumbnailUrl ? [h.thumbnailUrl] : [],
        image: h.images?.[0] ?? h.thumbnailUrl ?? (h.image || undefined),
        rating: h.reviewScore ?? h.reviewRating ?? h.rating,
        reviewScore: h.reviewScore ?? h.reviewRating,
        reviewCount: h.reviewCount ?? h.reviews,
        refundableTag: h.refundableTag,
        starRating: h.starRating,
        location: h.location,
        city: h.city,
        country: h.country,
        boardType: h.boardType,
        priceLoading: h.priceLoading,
        originalPrice: h.originalPrice,
    };
}

/** What the stream's `content` event carries for one hotel. */
export interface ContentPatch {
    images?: string[];
    name?: string;
    lat?: number;
    lng?: number;
}

/**
 * Fold a `content` event into the hotels already on screen.
 *
 * The server sends priced hotels first and their name, position and pictures a
 * moment later, so this is where an unnamed, unplaced row becomes a real one.
 * Only what is still a placeholder is overwritten, so a card never flickers to
 * a different picture than the one being looked at.
 *
 * The placeholders do not look empty, which is the trap: the name is the hotel
 * code and the position is 0, both of which a plain `||` reads as already set.
 * The previous version asked `h.name || patch.name`, so the real name never
 * won, and it did not carry lat/lng across at all.
 */
export function applyContentPatch(
    hotels: MappableProperty[],
    patches: Record<string, ContentPatch>,
): MappableProperty[] {
    return hotels.map(h => {
        const patch = patches[h.id];
        if (!patch) return h;

        const unnamed = !h.name || h.name === h.id;
        const unplaced = !h.coordinates.lat && !h.coordinates.lng;
        const placeable = Number.isFinite(patch.lat) && Number.isFinite(patch.lng);

        return {
            ...h,
            images: h.images?.length ? h.images : (patch.images ?? h.images),
            image: h.image || patch.images?.[0] || h.image,
            name: unnamed && patch.name ? patch.name : h.name,
            coordinates: unplaced && placeable
                ? { lat: Number(patch.lat), lng: Number(patch.lng) }
                : h.coordinates,
        };
    });
}
