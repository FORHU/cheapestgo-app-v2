/**
 * The colours the nearby explorer paints with — the property page's palette (ADR-0004), which it
 * passes down as is. Declared here structurally so the explorer does not import the page.
 */
export interface NearbyPalette {
    bg: string;
    title: string;
    text: string;
    muted: string;
    soft: string;
    hairline: string;
    cardBg: string;
    cardBorder: string;
    iconBg: string;
    mapStyle: string;
}

export interface LatLng {
    lat: number;
    lng: number;
}

/** Mapbox's Optimization API takes 12 coordinates; the hotel is one of them. */
export const MAX_TRIP_STOPS = 11;
