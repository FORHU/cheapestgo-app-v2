/** A Google Maps search for the place, pinned to Google's own id when there is one. */
export function googleMapsUrl(place: { name: string; placeId?: string }): string {
    const qs = new URLSearchParams({ api: '1', query: place.name });
    if (place.placeId) qs.set('query_place_id', place.placeId);
    return `https://www.google.com/maps/search/?${qs.toString()}`;
}

/** The URL if it is http(s), else null — a place's website comes from Google and is rendered as a link. */
export function safeHttpUrl(s?: string | null): string | null {
    if (!s) return null;
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:' ? s : null;
    } catch {
        return null;
    }
}
