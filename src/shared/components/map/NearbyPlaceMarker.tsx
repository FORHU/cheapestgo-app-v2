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
 * Entrance stagger: each marker waits this much longer than the one before it,
 * so the batch pops in as a sequence rather than a single flash.
 *
 * Capped, because the delay is the whole cost of the effect. A dense
 * neighbourhood can return forty places, and at 35ms apiece the last one would
 * land a second and a half after the first — long enough to read as the map
 * still loading rather than as an entrance.
 */
const POP_STAGGER_MS  = 35;
const POP_STAGGER_CAP = 12;

/**
 * The same idea on the way out, but tighter. Leaving is a response to something
 * the user just did — closing the preview card — so it has to keep up with them
 * in a way that arriving does not.
 */
const POP_OUT_STAGGER_MS  = 16;
const POP_OUT_STAGGER_CAP = 8;
/** Must match the `map-poi-pop-out` duration in globals.css. */
const POP_OUT_MS = 240;

/**
 * How long the whole batch takes to clear the map.
 *
 * The container keeps the markers mounted for exactly this long after the
 * selection drops — an unmounted element cannot play an exit — so this is the
 * one number the two sides have to agree on.
 */
export const POI_EXIT_MS = POP_OUT_MS + POP_OUT_STAGGER_MS * POP_OUT_STAGGER_CAP;

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
    /** Position in the batch, which sets how long this marker waits to pop in. */
    index?: number;
    /** On its way off the map: play the exit instead of the entrance. */
    leaving?: boolean;
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
    index = 0,
    leaving = false,
}: NearbyPlaceMarkerProps) {
    const Icon = getCategoryIcon(place.category);

    /**
     * The stagger belongs to when this marker first appeared, not to where it
     * currently sits in the list — so it is captured once and never recomputed.
     *
     * The list churns well after its first render. The three category fetches
     * resolve in whatever order the network hands them back, and each one then
     * enriches its own results in the background, dropping low-rated places as
     * it goes (see useNearbyGems). Every removal shifts the index of every
     * marker behind it.
     *
     * That matters more than it looks. Rewriting `animation-delay` on an
     * already-finished animation does not leave it alone: it moves the element
     * back into the animation's "before" phase, where the `backwards` fill
     * re-applies the opening keyframe. The marker blinks out and pops a second
     * time. Freezing the delay is what makes the pop happen exactly once.
     */
    const [popDelayMs] = React.useState(
        () => Math.min(index, POP_STAGGER_CAP) * POP_STAGGER_MS,
    );

    return (
        <Marker
            latitude={place.lat}
            longitude={place.lng}
            anchor="bottom"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick(place);
            }}
            style={{
                zIndex: isSelected ? 25 : 5,
                cursor: 'pointer',
                // A marker on its way out is still on the map for a few hundred
                // milliseconds. Tapping one would open a place the user has just
                // dismissed, so it stops taking input the moment it starts to go.
                pointerEvents: leaving ? 'none' : undefined,
            }}
        >
            {/* The pop lives on its own wrapper, one level out from the selected
                scale below. Both are transforms, and on a single element the
                animation would win outright — the disc would finish popping in
                and then refuse to grow when tapped. Nested, they compose.

                Swapping the class swaps `animation-name`, which is the one
                change that restarts an animation outright — so the exit plays
                from its first frame however far through the entrance the marker
                got. The exit's own delay can read the live index safely: the
                batch is frozen the moment it starts leaving. */}
            <div
                className={leaving ? 'map-poi-pop-out' : 'map-poi-pop'}
                style={{
                    animationDelay: leaving
                        ? `${Math.min(index, POP_OUT_STAGGER_CAP) * POP_OUT_STAGGER_MS}ms`
                        : `${popDelayMs}ms`,
                }}
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
            </div>
        </Marker>
    );
});

export { NearbyPlaceMarker };
