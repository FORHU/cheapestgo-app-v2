'use client';

import React from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { Star, MapPin, X } from 'lucide-react';
import { env } from '@/shared/lib/env';
import type { NearbyPlace } from './useMapNearbyPlaces';
import { getCategoryIcon } from './NearbyPlaceMarker';

interface NearbyPlacePopupProps {
    place: NearbyPlace;
    distanceKm: number | null;
    onClose: () => void;
}

/** Card geometry, from the design's 243px artboard. */
const CARD_W = 243;
const IMG_W  = 88;
/**
 * A floor, not a fixed height. The photo column stretches to whatever the text
 * beside it needs, so a name that wraps grows the card rather than overflowing
 * a fixed box — but at the design's proportions the text is shorter than this,
 * and without the floor the card would sit squatter than drawn.
 */
const CARD_MIN_H = 103;

/**
 * How far above the coordinate the card floats.
 *
 * The marker anchors its own bottom to the same point and stands 40px tall —
 * a 34px disc over a 9px pointer, overlapping by 3 — which becomes 48px under
 * the 1.2× it wears while selected, and selected is the only state that opens
 * this card. So the clearance is measured from that, not from the resting
 * height, plus a little air.
 */
const MARKER_CLEARANCE = 54;

/** `bus_station` → `Bus Station`. */
function formatCategory(raw: string): string {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Metres below a kilometre, kilometres above it — spelled as the design writes them. */
function formatDistance(km: number): string {
    return km < 1
        ? `${Math.round(km * 1000)}m from the hotel`
        : `${km.toFixed(1)}km from the hotel`;
}

/**
 * The API's photo proxy — the same query the gems list builds, so a place the
 * list has already shown is served from a warm cache here.
 */
function poiImageUrl(place: NearbyPlace): string | null {
    const base = env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    const qs = new URLSearchParams({
        name: place.name,
        lat:  String(place.lat),
        lng:  String(place.lng),
    });
    if (place.placeId)  qs.set('placeId', place.placeId);
    if (place.category) qs.set('category', place.category);
    return `${base}/photos/poi?${qs.toString()}`;
}

/**
 * The preview that opens on a place of interest: a photo, what the place is,
 * and the two facts that decide whether it is worth the walk.
 *
 * Colours come from `--map-card-*` (globals.css), which follow the app theme
 * directly, like the markers do, rather than contrasting the basemap. The
 * Mapbox popup chrome around it is stripped in the same stylesheet.
 */
const NearbyPlacePopup = React.memo(function NearbyPlacePopup({
    place,
    distanceKm,
    onClose,
}: NearbyPlacePopupProps) {
    // The proxy 404s for places Google has no photo of, which is common for
    // transit stops. The category glyph stands in rather than an empty well.
    const [imageFailed, setImageFailed] = React.useState(false);
    React.useEffect(() => setImageFailed(false), [place.placeId, place.name]);

    const src = poiImageUrl(place);
    const Glyph = getCategoryIcon(place.category);

    const rows: { key: string; icon: React.ReactNode; text: string }[] = [];
    if (place.rating !== undefined) {
        rows.push({
            key: 'rating',
            icon: <Star size={11} fill="currentColor" strokeWidth={0} />,
            text: `${place.rating.toFixed(1)} Ratings`,
        });
    }
    if (distanceKm !== null) {
        rows.push({
            key: 'distance',
            // `currentColor`, like the star: the row already carries the card's
            // foreground, which is white on the dark card the design draws and
            // flips to near-black when the card does. A literal white would
            // disappear in that other tone.
            icon: <MapPin size={11} fill="currentColor" strokeWidth={0} />,
            text: formatDistance(distanceKm),
        });
    }

    return (
        <Popup
            latitude={place.lat}
            longitude={place.lng}
            anchor="bottom"
            offset={MARKER_CLEARANCE}
            closeOnClick={false}
            closeButton={false}
            onClose={onClose}
            className="map-poi-popup"
            maxWidth={`${CARD_W}px`}
        >
            <div style={{
                position: 'relative',
                display: 'flex', width: CARD_W, minHeight: CARD_MIN_H,
                borderRadius: 15,
                // The photo runs to the card's edges and is clipped to its
                // corners here, rather than carrying a radius of its own — that
                // way the two curves cannot drift apart, and the photo's square
                // right edge needs no special-casing.
                overflow: 'hidden',
                background: 'var(--map-card-bg)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
            }}>
                {/* Mapbox's own close button is off (`closeButton={false}`) — it
                    paints outside the card's rounded corner and takes the popup
                    ground with it. This one sits on the card, in the design's
                    tones. */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={`Close ${place.name} preview`}
                    className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-70"
                    style={{
                        position: 'absolute', top: 6, right: 6, zIndex: 1,
                        width: 22, height: 22,
                        background: 'var(--map-card-well)',
                        color: 'var(--map-card-muted)',
                        border: 'none', padding: 0,
                    }}
                >
                    <X size={13} strokeWidth={2.5} />
                </button>

                {/* `position: relative` with the photo laid absolutely inside it:
                    a stretched flex item has no height for a percentage to
                    resolve against, so `height: 100%` on the image alone
                    collapsed it to its intrinsic size. */}
                <div style={{
                    position: 'relative',
                    width: IMG_W, flexShrink: 0, alignSelf: 'stretch',
                    background: 'var(--map-card-well)',
                    color: 'var(--map-card-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {src && !imageFailed ? (
                        // A plain <img>: next/image only permits https remotes here,
                        // and the API is reached over http in development.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={src}
                            alt={place.name}
                            onError={() => setImageFailed(true)}
                            style={{
                                position: 'absolute', inset: 0,
                                width: '100%', height: '100%',
                                objectFit: 'cover', display: 'block',
                            }}
                        />
                    ) : (
                        <Glyph size={22} />
                    )}
                </div>

                {/* The card's padding lives here now that the photo is flush to
                    its edges. Only these two lines sit under the close button,
                    so only they are inset for it — indenting the whole column
                    would have narrowed the rows below for nothing. */}
                <div style={{
                    minWidth: 0, flex: 1,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    padding: '11px 12px',
                }}>
                    <h3 style={{
                        fontSize: 12.5, fontWeight: 600, color: 'var(--map-card-fg)', lineHeight: 1.25,
                        paddingRight: 20,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {place.name}
                    </h3>
                    <p style={{
                        fontSize: 10, color: 'var(--map-card-muted)', marginTop: 3, lineHeight: 1.3,
                        paddingRight: 20,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {formatCategory(place.category)}
                    </p>

                    {rows.map((row, i) => (
                        <div key={row.key} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            marginTop: i === 0 ? 8 : 6,
                            fontSize: 10.5, fontWeight: 500,
                            color: 'var(--map-card-fg)', lineHeight: 1.2,
                        }}>
                            <span style={{ flexShrink: 0, display: 'flex' }}>{row.icon}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </Popup>
    );
});

export { NearbyPlacePopup };
export type { NearbyPlacePopupProps };
