'use client';

import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import type { NearbyPlace } from './useMapNearbyPlaces';
import {
    FoodGlyph, ParkGlyph, StoreGlyph, CafeGlyph, MedicalGlyph, TransitGlyph, PlaceGlyph,
    type PoiGlyph,
} from './poi-icons';

/** Circle diameter and the glyph inside it, in px. */
const SIZE = 34;
const ICON = 17;

/**
 * The six categories the design draws, plus a fallback for anything that
 * matches none of them. Cafés split out of food so the cup gets used, and
 * attractions fold into the trees rather than falling through to the pin.
 *
 * Order matters: the narrower tests run first, so `cafe` claims a coffee shop
 * before `food` can, and `market` doesn't swallow `supermarket`.
 */
export function getCategoryIcon(category: string): PoiGlyph {
    const cat = category.toLowerCase();
    if (cat.includes('cafe') || cat.includes('coffee') || cat.includes('bakery') || cat.includes('tea'))
        return CafeGlyph;
    if (cat.includes('restaurant') || cat.includes('food') || cat.includes('bar') || cat.includes('dining'))
        return FoodGlyph;
    // Attractions share the trees. Sightseeing has no mark of its own in the
    // set, and the pin fallback it used to get is the "uncategorised" glyph —
    // the one shape on the map that says nothing about the place. Green space
    // is the closest thing the design draws to a day out.
    if (cat.includes('park') || cat.includes('garden') || cat.includes('nature') || cat.includes('forest') ||
        cat.includes('attraction') || cat.includes('tourist') || cat.includes('sightseeing') ||
        cat.includes('landmark') || cat.includes('monument') || cat.includes('museum') ||
        cat.includes('gallery') || cat.includes('zoo') || cat.includes('temple') || cat.includes('shrine'))
        return ParkGlyph;
    if (cat.includes('supermarket') || cat.includes('grocery') || cat.includes('convenience') ||
        cat.includes('store') || cat.includes('shop') || cat.includes('mall') || cat.includes('market'))
        return StoreGlyph;
    if (cat.includes('hospital') || cat.includes('pharmacy') || cat.includes('medical') ||
        cat.includes('doctor') || cat.includes('dentist') || cat.includes('clinic'))
        return MedicalGlyph;
    if (cat.includes('bus') || cat.includes('train') || cat.includes('station') ||
        cat.includes('transit') || cat.includes('subway') || cat.includes('airport'))
        return TransitGlyph;
    return PlaceGlyph;
}

interface NearbyPlaceMarkerProps {
    place: NearbyPlace;
    isSelected: boolean;
    onClick: (place: NearbyPlace) => void;
}

/**
 * A place of interest: a solid disc carrying a contrasting glyph, on a short
 * pointer that marks the coordinate.
 *
 * Colours come from `--map-card-*` (globals.css) — the same pair the preview
 * card uses, so the disc and the card it opens are one mark — and invert against
 * the app theme so the disc always contrasts the basemap: black-on-light in
 * light mode, white-on-dark in dark mode. Variables rather than a prop, so a
 * theme switch is a repaint rather than a re-render of every marker.
 *
 * The pointer overlaps the disc rather than butting against it — the disc's
 * edge is a curve, so a triangle sitting on the tangent would leave a hairline
 * of background either side of the join.
 */
const NearbyPlaceMarker = React.memo(function NearbyPlaceMarker({
    place,
    isSelected,
    onClick,
}: NearbyPlaceMarkerProps) {
    const Icon = getCategoryIcon(place.category);

    return (
        <Marker
            latitude={place.lat}
            longitude={place.lng}
            anchor="bottom"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick(place);
            }}
            style={{ zIndex: isSelected ? 25 : 5, cursor: 'pointer' }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                    transformOrigin: 'center bottom',
                    transition: 'transform 180ms cubic-bezier(0.34, 1.3, 0.64, 1)',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        width: SIZE,
                        height: SIZE,
                        borderRadius: '50%',
                        background: 'var(--map-card-bg)',
                        color: 'var(--map-card-fg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
                    }}
                >
                    {/* Glyphs fill with currentColor, inherited from the disc. */}
                    <Icon size={ICON} />
                </div>

                {/* Pointer — above the disc in stacking order so the disc's own
                    shadow can't smudge across it; same colour, so the overlap
                    is invisible. */}
                <svg
                    width="14"
                    height="9"
                    viewBox="0 0 14 9"
                    style={{ position: 'relative', display: 'block', marginTop: -3, zIndex: 2 }}
                    aria-hidden="true"
                >
                    <polygon
                        points="1.5,0 12.5,0 7,6.5"
                        style={{ fill: 'var(--map-card-bg)', stroke: 'var(--map-card-bg)' }}
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
        </Marker>
    );
});

export { NearbyPlaceMarker };
