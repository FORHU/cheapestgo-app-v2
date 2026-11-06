'use client';

import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { HotelPin } from './HotelPin';

/**
 * How long the pin takes to leave. Must match the `map-poi-pop-out` duration in
 * globals.css: the caller keeps the pin mounted this long after it is told to
 * go, since an unmounted element cannot play its exit.
 */
export const LOADING_PIN_EXIT_MS = 240;

interface LoadingPinProps {
    longitude: number;
    latitude: number;
    /** On its way off the map: plays the exit instead of the entrance. */
    leaving?: boolean;
}

/**
 * One pin at the centre of the search, held there while the hotels are still
 * coming in.
 *
 * The search draws no hotel pins until it has finished (see `NO_PINS` in
 * SearchMapContainer), so without this the map sits empty and reads as a city
 * with nothing in it. This is a hotel pin with nothing filled in yet: the
 * thumbnail spins and the price is the dots an unpriced pin already shows. It
 * leaves as the real pins land.
 *
 * It enters and leaves with the nearby-place pop (globals.css), so it reads as
 * a marker dropping onto the map, not as an overlay fading in front of it.
 * Purely visual: the page's "Searching for stays" pill is what announces the
 * search, so this is hidden from assistive tech and takes no pointer events.
 */
export function LoadingPin({ longitude, latitude, leaving = false }: LoadingPinProps) {
    return (
        <Marker
            longitude={longitude}
            latitude={latitude}
            anchor="bottom"
            style={{ zIndex: 5, pointerEvents: 'none' }}
        >
            <div
                aria-hidden="true"
                className={leaving ? 'map-poi-pop-out' : 'map-poi-pop'}
                // A beat into the map's fade-in, so the pin lands on a map that is
                // already there rather than popping on the cover as it lifts.
                style={{ animationDelay: leaving ? '0ms' : '180ms' }}
            >
                <HotelPin busy priceLabel="" />
            </div>
        </Marker>
    );
}
