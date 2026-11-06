import { useEffect, useState } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';

/**
 * Longest the map stays covered. Past this the cover lifts whatever the tiles
 * are doing: on a slow connection the old tile-by-tile fill is better than a
 * blank panel that looks broken.
 */
const REVEAL_TIMEOUT_MS = 5000;

/**
 * Whether the map has drawn its first finished frame (every tile in view
 * loaded, the camera at rest), so it can be shown.
 *
 * Mapbox paints from its very first frame, so a map left uncovered fills in
 * tile by tile as each one arrives. The caller keeps the map under a cover until
 * this turns true and the map appears whole.
 *
 * Latches: once the map has been shown it is never covered again. Later loads
 * (a pan into new ground, a theme change) are the map responding to the user,
 * and hiding it then would read as the map going away.
 */
export function useMapReveal(mapRef: React.RefObject<MapRef | null>, isMapLoaded: boolean): boolean {
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (revealed || !isMapLoaded) return;
        const map = mapRef.current?.getMap();
        if (!map) return;

        const reveal = () => setRevealed(true);
        const fallback = setTimeout(reveal, REVEAL_TIMEOUT_MS);

        // One frame's grace before looking. Camera moves opened off the same
        // `isMapLoaded` (the district fitBounds) have to have begun first, or the
        // map reads as settled a frame before it flies somewhere still unloaded.
        //
        // Settled now: show it. Otherwise wait for `idle`, which Mapbox fires
        // once nothing is moving and every tile in view has loaded. Checking
        // first matters because `idle` only fires after a render, and a map that
        // is already done renders nothing more.
        const raf = requestAnimationFrame(() => {
            if (!map.isMoving() && map.loaded() && map.areTilesLoaded()) reveal();
            else map.once('idle', reveal);
        });

        return () => {
            clearTimeout(fallback);
            cancelAnimationFrame(raf);
            map.off('idle', reveal);
        };
    }, [isMapLoaded, revealed, mapRef]);

    return revealed;
}
