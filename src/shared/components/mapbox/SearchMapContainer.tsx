'use client';

import React, { useMemo, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MappableProperty } from '@/shared/components/map/types';
import { useMapboxInstance } from './hooks/useMapboxInstance';
import { useMapInteractions, PoiData } from './hooks/useMapInteractions';
import { useMapViewport } from './hooks/useMapViewport';
import { MapContainer } from './components/MapContainer';
import { SelectedPropertyPopup } from './components/SelectedPropertyPopup';
import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import { PoiPopup } from './components/PoiPopup';
import { MapSearchOverlay } from './components/MapSearchOverlay';
import { useRouter } from 'next/navigation';
import { useUserCurrency } from '@/shared/stores/search.store';
import { convertCurrency } from '@/shared/lib/currency';
import { useMapDetails } from './hooks/useMapDetails';
import { MapDetailsPanel } from './components/MapDetailsPanel';
import { env } from '@/shared/lib/env';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';
import { formatCurrency } from '@/shared/lib/format';
import { NearbyPlaceMarker, POI_EXIT_MS } from '@/shared/components/map/NearbyPlaceMarker';
import { HotelPin } from '@/shared/components/map/HotelPin';
import { useTheme } from '@/shared/components/ThemeContext';
import { NearbyPlacePopup } from '@/shared/components/map/NearbyPlacePopup';
import { useNearbyGems, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import type { NearbyPlace } from '@/shared/components/map/useMapNearbyPlaces';
import type { MapEvent } from 'react-map-gl/mapbox';
import type { Marker as MapboxMarker } from 'mapbox-gl';
import { isAbortError } from '@/shared/lib/error';

/**
 * A place on the map, plus where it sits in the entrance stagger.
 *
 * `popIndex` is per *arrival*, not per list position. The places come in three
 * category batches at three different moments, and a marker in the second batch
 * has to start counting its wait from zero — take its index in the combined
 * list instead and it inherits whatever the first batch left off at, which at
 * this list's length is the stagger cap: it would sit invisible for the better
 * part of half a second after landing.
 */
type DrawnPlace = NearbyPlace & { popIndex: number };

/** Identity of a place, used both to dedupe the batch and to key the marker. */
const placeKey = (p: { name: string; lat: number; lng: number }) => `${p.name}-${p.lat}-${p.lng}`;

/**
 * Fold an incoming list into the batch already on the map: keep every place
 * that is there, add the ones that are not, and number the arrivals from zero.
 *
 * Additive on purpose — see the call site. Returns `prev` untouched when
 * nothing new arrived, so the repeated upstream updates that carry no new
 * places (a rating landing, a re-sorted hotel list changing an object's
 * identity) stop short of re-rendering every marker.
 */
function withPopOrder(prev: DrawnPlace[], incoming: NearbyPlace[]): DrawnPlace[] {
    const byKey = new Map(prev.map(p => [placeKey(p), p]));
    let arrivals = 0;
    for (const place of incoming) {
        const key = placeKey(place);
        if (byKey.has(key)) continue;
        byKey.set(key, { ...place, popIndex: arrivals++ });
    }
    return arrivals === 0 ? prev : Array.from(byKey.values());
}

// Haversine distance
const calculateDistance = (l1: { lat: number; lng: number }, l2: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = (l2.lat - l1.lat) * (Math.PI / 180);
    const dLng = (l2.lng - l1.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(l1.lat * (Math.PI / 180)) * Math.cos(l2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createCircleGeoJSON(center: [number, number], radiusMeters: number): GeoJSON.Feature<GeoJSON.Polygon> {
    const points = 64;
    const coords: [number, number][] = [];
    const R = 6371000;
    const lat = (center[1] * Math.PI) / 180;
    const lng = (center[0] * Math.PI) / 180;
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dlat = (radiusMeters / R) * Math.cos(angle);
        const dlng = (radiusMeters / R) * Math.sin(angle) / Math.cos(lat);
        coords.push([((lng + dlng) * 180) / Math.PI, ((lat + dlat) * 180) / Math.PI]);
    }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

const DISTRICT_MARKER_THRESHOLD = 11;

/**
 * The nearby-places radius, as ink rather than as a colour of its own.
 *
 * It was a blue that belonged to nothing else on the map and read as a feature
 * in its own right. Blackish reads as a measurement — but only over the day
 * basemap; the night preset would swallow it, so the dark theme takes the same
 * ink inverted against the basemap instead. That's a different rule than the
 * POI discs follow (they take the app theme directly via `--map-card-*`) —
 * this ring is a Mapbox paint property, which can't read a CSS custom
 * property at all, so it carries its own light/dark pair rather than reusing
 * theirs.
 */
const RADIUS_INK = { light: '#141414', dark: '#E6E6E6' } as const;

/**
 * Zoom the map settles on when a hotel is picked — close enough to read the
 * surrounding streets and see which block the hotel sits on, without losing
 * the neighbouring pins entirely.
 */
const SELECT_ZOOM = 15.5;

/**
 * How many hotel pins a single create/remove pass will mount inline before
 * handing the rest to `requestAnimationFrame` — see docs/adr/0002-*. Below
 * this, staggering would add complexity for a batch too small to be visible
 * as jank; above it (the initial city-wide fit, or "See all in {city}"
 * dropping the district filter), a hundred-odd markers mounting in one
 * frame is not.
 */
const MARKER_STAGGER_THRESHOLD = 30;
/**
 * Markers created per animation frame once staggering kicks in. Chosen
 * conservatively for the ~16ms frame budget given each one is a real
 * `createRoot()` mount, not just a DOM append — loosen if profiling shows
 * headroom. `requestAnimationFrame` rather than `requestIdleCallback`:
 * Safari/iOS has no `requestIdleCallback`, and this is a booking site.
 */
const MARKER_STAGGER_CHUNK = 15;

// Fixed offsets (in degrees) for loading placeholder pins around the city centre
const LOADING_PIN_OFFSETS = [
    { lat:  0.000, lng:  0.000 },
    { lat:  0.012, lng:  0.018 },
    { lat: -0.010, lng: -0.015 },
    { lat:  0.008, lng: -0.020 },
    { lat: -0.015, lng:  0.010 },
];

interface SearchMapContainerProps {
    properties: MappableProperty[];
    selectedId: string | null;
    onSelectId: (id: string | null) => void;
    hoveredId: string | null;
    onHoverId: (id: string | null) => void;
    onViewDetails: (id: string, offerId?: string) => void;
    searchOverlayClassName?: string;
    defaultCenter?: { lng: number; lat: number };
    isSearching?: boolean;
    districtBbox?: [number, number, number, number];
    districtName?: string;
    cityName?: string;
    onZoomChange?: (zoom: number) => void;
    showAllProperties?: boolean;
    /**
     * Whether to draw the nearby-place discs and their radius. Owned by the
     * toolbar's toggle, which lives on the search page — the map only obeys it.
     * Defaults on, so the map behaves as it always has if nobody passes it.
     */
    showPois?: boolean;
    /** Number of nights in the search — used to convert total-stay prices to per-night display prices. */
    nights?: number;
}

export const SearchMapContainer = React.memo(({
    properties,
    selectedId,
    onSelectId,
    hoveredId,
    onHoverId,
    onViewDetails,
    searchOverlayClassName,
    defaultCenter,
    isSearching,
    districtBbox,
    districtName: _districtName,
    cityName: _cityName,
    onZoomChange,
    showAllProperties,
    showPois = true,
    nights = 1,
}: SearchMapContainerProps) => {
    const { mapRef, isMapLoaded, isMapIdle, handleMapLoad: instanceHandleMapLoad, handleMapStyleChange } = useMapboxInstance();
    const isMobile = useIsMobile();
    const router = useRouter();
    const targetCurrency = useUserCurrency();
    const { theme } = useTheme();

    const mappableProperties = useMemo(() =>
        properties.filter(p =>
            p.coordinates &&
            isFinite(p.coordinates.lat) &&
            isFinite(p.coordinates.lng) &&
            p.coordinates.lat !== 0 &&
            p.coordinates.lng !== 0 &&
            p.coordinates.lat >= -90 &&
            p.coordinates.lat <= 90 &&
            p.coordinates.lng >= -180 &&
            p.coordinates.lng <= 180
        ),
        [properties]
    );

    // Center for loading placeholder pins — use defaultCenter, fall back to first hotel's coords
    const loadingPinCenter = useMemo(
        () => defaultCenter ?? mappableProperties[0]?.coordinates ?? null,
        [defaultCenter, mappableProperties]
    );

    const markerPrices = useMemo(() => {
        const prices: Record<string, number> = {};
        for (const p of mappableProperties) {
            prices[p.id] = convertCurrency(p.price, p.currency || 'USD', targetCurrency) / nights;
        }
        return prices;
    }, [mappableProperties, targetCurrency, nights]);

    const _displayPrices = useMemo(() => {
        const formatted: Record<string, string> = {};
        for (const p of mappableProperties) {
            formatted[p.id] = formatCurrency(markerPrices[p.id] || 0, targetCurrency);
        }
        return formatted;
    }, [mappableProperties, markerPrices, targetCurrency]);

    const [currentZoom, setCurrentZoom] = React.useState(12);

    const handleMapLoad = useCallback((_e?: MapEvent) => {
        instanceHandleMapLoad();
    }, [instanceHandleMapLoad]);

    const markerProperties = useMemo(() => {
        if (!districtBbox || showAllProperties || currentZoom < DISTRICT_MARKER_THRESHOLD) return mappableProperties;
        const [minLng, minLat, maxLng, maxLat] = districtBbox;
        return mappableProperties.filter(p =>
            p.coordinates.lng >= minLng && p.coordinates.lng <= maxLng &&
            p.coordinates.lat >= minLat && p.coordinates.lat <= maxLat
        );
    }, [mappableProperties, districtBbox, currentZoom, showAllProperties]);

    /**
     * Bounds a hotel pin has to fall within to get a live marker — the map's
     * current view, padded by half a screen so an ordinary pan doesn't pop
     * pins in right at the edge. Recomputed on `moveend` only (see
     * `handleMoveEnd`), never mid-drag: panning itself must not get more
     * expensive than it already is. See docs/adr/0002-*.
     *
     * Padding is measured in screen pixels via `unproject`, not degrees — a
     * fixed-degree pad would be far too generous zoomed in and far too tight
     * zoomed out.
     */
    const [cullBounds, setCullBounds] = React.useState<{
        minLng: number; maxLng: number; minLat: number; maxLat: number;
    } | null>(null);

    const computeCullBounds = useCallback(() => {
        const map = mapRef.current?.getMap?.();
        const canvas = map?.getCanvas();
        const w = canvas?.clientWidth ?? 0;
        const h = canvas?.clientHeight ?? 0;
        if (!map || !w || !h) return null;
        const pad = 0.5;
        const nw = map.unproject([-w * pad, -h * pad]);
        const se = map.unproject([w * (1 + pad), h * (1 + pad)]);
        return {
            minLng: Math.min(nw.lng, se.lng), maxLng: Math.max(nw.lng, se.lng),
            minLat: Math.min(nw.lat, se.lat), maxLat: Math.max(nw.lat, se.lat),
        };
    }, [mapRef]);

    // Bounds may not exist yet on first paint if the map settles into its
    // initial view without ever firing `moveend` (no fly-to was needed).
    // This backfills them once, without clobbering a real `moveend` result
    // that beat it there.
    React.useEffect(() => {
        if (!isMapLoaded || !isMapIdle) return;
        setCullBounds(prev => prev ?? computeCullBounds());
    }, [isMapLoaded, isMapIdle, computeCullBounds]);

    /**
     * The hotels that actually get a marker. Not clustering — every pin here
     * is still its own full, unmerged marker — just narrowed to the ones the
     * map is currently looking at. See docs/adr/0002-*.
     */
    const culledMarkerProperties = useMemo(() => {
        if (!cullBounds) return markerProperties;
        return markerProperties.filter(p =>
            p.coordinates.lng >= cullBounds.minLng && p.coordinates.lng <= cullBounds.maxLng &&
            p.coordinates.lat >= cullBounds.minLat && p.coordinates.lat <= cullBounds.maxLat
        );
    }, [markerProperties, cullBounds]);

    const [selectedPoi, setSelectedPoi] = React.useState<PoiData | null>(null);
    const [hoveredPoi, setHoveredPoi] = React.useState<PoiData | null>(null);

    const [routeGeometry, setRouteGeometry] = React.useState<GeoJSON.Geometry | null>(null);
    const [carDuration, setCarDuration] = React.useState<string | null>(null);
    const [walkDuration, setWalkDuration] = React.useState<string | null>(null);

    const { handleMapClick, onMouseMove, attachMouseLeave } = useMapInteractions({
        mapRef,
        onSelectId,
        onSelectPoi: setSelectedPoi,
        onHoverPoi: setHoveredPoi,
    });

    React.useEffect(() => {
        if (!isMapLoaded || !mapRef.current) return;
        const map = mapRef.current.getMap();
        if (!map) return;
        const cleanup = attachMouseLeave(map);
        return cleanup;
    }, [isMapLoaded, attachMouseLeave, mapRef]);

    // Track movement so pins can ignore the mouseenter events a moving map
    // generates. Any hover already showing is dropped when the map starts to move.
    React.useEffect(() => {
        if (!isMapLoaded || !mapRef.current) return;
        const map = mapRef.current.getMap();
        if (!map) return;
        const start = () => { mapMovingRef.current = true; onHoverIdRef.current(null); };
        const end   = () => { mapMovingRef.current = false; };
        map.on('movestart', start);
        map.on('zoomstart', start);
        map.on('moveend', end);
        map.on('zoomend', end);
        return () => {
            map.off('movestart', start);
            map.off('zoomstart', start);
            map.off('moveend', end);
            map.off('zoomend', end);
        };
    }, [isMapLoaded, mapRef]);

    // skipInitialFit is never set: useMapViewport returns early via the `center`
    // branch when defaultCenter is provided, so it won't run fitBounds on all
    // properties even when a district bbox is active.
    useMapViewport({ mapRef, isMapLoaded, properties: mappableProperties, center: defaultCenter, selectedId, disableFlyToSelected: true });


    // ── Imperative hotel pin markers ─────────────────────────────────────────
    // We bypass react-map-gl's Marker portal system (which silently fails to
    // paint pins after the map style finishes loading) and create raw
    // mapboxgl.Marker instances directly. createRoot renders React content
    // into each marker's DOM element so the pin visuals still come from React.
    type MarkerEntry = { marker: MapboxMarker; root: Root; el: HTMLDivElement; visible: boolean };
    const imperativeMarkersRef = React.useRef<Map<string, MarkerEntry>>(new Map());
    // mapbox-gl Marker class, loaded once on mount. Kept in state so the
    // marker effect re-fires if it ran before the dynamic import resolved.
    const [MapboxMarkerClass, setMapboxMarkerClass] = React.useState<typeof MapboxMarker | null>(null);

    React.useEffect(() => {
        import('mapbox-gl').then((mod) => {
            const Cls = mod.Marker ?? mod.default?.Marker ?? null;
            // Wrap in arrow so React doesn't treat the class as a setState updater
            setMapboxMarkerClass(() => Cls);
        }).catch(() => { /* ignore */ });
    }, []);

    // True while the map is panning or zooming — see the marker mouseenter below.
    const mapMovingRef = React.useRef(false);

    // Stable refs for callbacks — avoids recreating markers when parent re-renders
    const onSelectIdRef = React.useRef(onSelectId);
    const onHoverIdRef  = React.useRef(onHoverId);
    React.useEffect(() => { onSelectIdRef.current = onSelectId; }, [onSelectId]);
    React.useEffect(() => { onHoverIdRef.current  = onHoverId;  }, [onHoverId]);

    // The current and previous hover id, read live rather than depended on —
    // see the dedicated hover effect below, which is what owns hover updates
    // now. Depending on `hoveredId` in the create/remove effect used to mean
    // every hover re-rendered every mounted marker.
    const hoveredIdRef = React.useRef(hoveredId);
    const prevHoveredIdRef = React.useRef<string | null>(null);
    React.useEffect(() => { hoveredIdRef.current = hoveredId; }, [hoveredId]);

    // Property lookup by id, for the hover effect — kept as a ref so hovering
    // doesn't depend on (and re-run against) the full property list.
    const propertyByIdRef = React.useRef<Map<string, MappableProperty>>(new Map());
    React.useEffect(() => {
        propertyByIdRef.current = new Map(mappableProperties.map(p => [p.id, p]));
    }, [mappableProperties]);

    /**
     * Draws one marker's contents — the thumbnail, the price, the bouncing
     * dots while it streams in. A `useCallback`, not a plain inline function,
     * so both the create/remove effect below and the dedicated hover effect
     * can share the exact same render logic.
     */
    const renderPin = useCallback((root: Root, p: MappableProperty, isHov: boolean) => {
        const price = markerPrices[p.id] ?? 0;
        let priceLabel = '';
        try { priceLabel = price > 0 ? formatCurrency(price, targetCurrency) : ''; } catch { /* noop */ }
        root.render(
            // `pointerEvents: none` keeps clicks and hovers on the marker
            // element that owns the listeners. The pin's own colours come
            // from CSS variables, so nothing here depends on the theme.
            <div style={{ pointerEvents: 'none' }}>
                <HotelPin
                    image={p.image ?? p.images?.[0]}
                    priceLabel={priceLabel}
                    active={isHov}
                />
            </div>
        );
    }, [markerPrices, targetCurrency]);

    /**
     * Bumped on every create/remove pass. A staggered batch checks this
     * before creating its next chunk and bails out if a newer pass has since
     * started — otherwise a fast re-pan could leave two overlapping batches
     * both creating markers for the same properties.
     */
    const creationGenerationRef = React.useRef(0);

    React.useEffect(() => {
        if (!isMapLoaded || !isMapIdle) return;
        const mapInstance = mapRef.current?.getMap?.();
        if (!mapInstance) return;

        const MapboxMarker = MapboxMarkerClass;
        if (!MapboxMarker) return;

        const generation = ++creationGenerationRef.current;

        const currentIds = new Set(culledMarkerProperties.map(p => p.id));

        // Remove markers for hotels no longer in results — including ones
        // panned out of `culledMarkerProperties`'s padded bounds.
        // Defer root.unmount() — calling it synchronously inside a useEffect body
        // during React's commit phase causes "unmount during render" errors in React 19.
        const staleRoots: Root[] = [];
        for (const [id, entry] of imperativeMarkersRef.current.entries()) {
            if (!currentIds.has(id)) {
                entry.marker.remove();
                staleRoots.push(entry.root);
                imperativeMarkersRef.current.delete(id);
            }
        }
        if (staleRoots.length) {
            const roots = staleRoots;
            setTimeout(() => roots.forEach(r => { try { r.unmount(); } catch { /* noop */ } }), 0);
        }

        const createOne = (p: MappableProperty) => {
            const isSelected = p.id === selectedId;
            const isHov = hoveredIdRef.current === p.id;

            const el = document.createElement('div');
            el.style.cursor = 'pointer';
            el.style.zIndex = isHov ? '10' : '1';
            // Promotes the marker to its own compositor layer, so mapbox-gl's
            // per-frame position update during pan/zoom is a GPU transform
            // rather than a layout/paint pass. Safe as a static, always-on
            // property now that culling bounds how many of these exist at
            // once — see docs/adr/0002-*.
            el.style.willChange = 'transform';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelectIdRef.current(p.id);
            });
            // Ignored while the map is moving: zooming and panning slide the
            // pins under a stationary cursor, and the resulting mouseenter
            // made pins pop to their hover size for no reason the user could
            // see. Real hovers land on a settled map.
            el.addEventListener('mouseenter', () => {
                if (mapMovingRef.current) return;
                onHoverIdRef.current(p.id);
            });
            el.addEventListener('mouseleave', () => onHoverIdRef.current(null));

            const root = createRoot(el);
            renderPin(root, p, isHov);

            // Bottom-anchored so the pin's tail sits on the coordinate —
            // matches MapMarker, which draws the selected pin.
            const marker = new MapboxMarker({ element: el, anchor: 'bottom' })
                .setLngLat([p.coordinates.lng, p.coordinates.lat]);

            if (!isSelected) marker.addTo(mapInstance);

            imperativeMarkersRef.current.set(p.id, { marker, root, el, visible: !isSelected });
        };

        const toCreate: MappableProperty[] = [];
        for (const p of culledMarkerProperties) {
            if (!imperativeMarkersRef.current.has(p.id)) toCreate.push(p);
        }

        // Below the threshold, creating them all inline is invisible to the
        // user — staggering would only add complexity for nothing. Above it
        // (a big batch landing in one `moveend`, e.g. the initial city-wide
        // fit, or "See all in {city}" dropping the district filter), spread
        // the rest across frames so mounting a hundred-odd React roots does
        // not block a single frame outright.
        if (toCreate.length <= MARKER_STAGGER_THRESHOLD) {
            toCreate.forEach(createOne);
        } else {
            let i = 0;
            const runChunk = () => {
                // A newer create/remove pass has since started — this batch
                // is stale, stop rather than fight it for the same markers.
                if (generation !== creationGenerationRef.current) return;
                const end = Math.min(i + MARKER_STAGGER_CHUNK, toCreate.length);
                for (; i < end; i++) createOne(toCreate[i]);
                if (i < toCreate.length) requestAnimationFrame(runChunk);
            };
            runChunk();
        }

        // Markers that already exist: sync selection visibility and refresh
        // their contents (price/currency may have changed). Hover alone does
        // NOT belong here — see the dedicated hover effect below, which is
        // the fix for hover no longer re-rendering every marker.
        for (const p of culledMarkerProperties) {
            const existing = imperativeMarkersRef.current.get(p.id);
            if (!existing) continue; // newly created above, or still pending in a staggered chunk

            const isSelected = p.id === selectedId;
            if (isSelected && existing.visible) {
                existing.marker.remove();
                existing.visible = false;
            } else if (!isSelected && !existing.visible) {
                existing.marker.addTo(mapInstance);
                existing.visible = true;
            }

            const isHov = hoveredIdRef.current === p.id;
            renderPin(existing.root, p, isHov);
            existing.el.style.zIndex = isHov ? '10' : '1';
        }
    }, [isMapLoaded, isMapIdle, MapboxMarkerClass, culledMarkerProperties, selectedId, renderPin]); // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Hover, on its own. This is the fix for the bug where any hover change
     * used to re-render every mounted marker: it touches at most two — the
     * one losing hover and the one gaining it — via direct map lookups
     * rather than looping `culledMarkerProperties`.
     *
     * A hovered id with no entry here is a hotel the map isn't currently
     * looking at (culled out by the padded-bounds effect above) — hovering
     * its rail card is a deliberate no-op, not a bug: there is no marker on
     * screen for it to highlight, and the map does not pan to reveal one.
     */
    React.useEffect(() => {
        const prevId = prevHoveredIdRef.current;
        prevHoveredIdRef.current = hoveredId;
        if (prevId === hoveredId) return;

        if (prevId) {
            const entry = imperativeMarkersRef.current.get(prevId);
            const p = propertyByIdRef.current.get(prevId);
            if (entry && p) {
                renderPin(entry.root, p, false);
                entry.el.style.zIndex = '1';
            }
        }
        if (hoveredId) {
            const entry = imperativeMarkersRef.current.get(hoveredId);
            const p = propertyByIdRef.current.get(hoveredId);
            if (entry && p) {
                renderPin(entry.root, p, true);
                entry.el.style.zIndex = '10';
            }
        }
    }, [hoveredId, renderPin]);

    // Cleanup all imperative markers on unmount
    React.useEffect(() => {
        const markersRef = imperativeMarkersRef;
        return () => {
            const roots: Root[] = [];
            for (const { marker, root } of markersRef.current.values()) {
                try { marker.remove(); } catch { /* noop */ }
                roots.push(root);
            }
            markersRef.current.clear();
            // Defer unmount — synchronously unmounting React roots inside a cleanup
            // that fires during React's own commit phase causes "unmount during render".
            setTimeout(() => roots.forEach(r => { try { r.unmount(); } catch { /* noop */ } }), 0);
        };
    }, []);
    // ─────────────────────────────────────────────────────────────────────────

    React.useEffect(() => {
        if (!selectedId || !isMapLoaded) return;
        const prop = mappableProperties.find(p => p.id === selectedId);
        if (!prop) return;
        // Close in on the selection, but never pull back: `max` of the current
        // zoom, so picking a hotel from an already-close view holds that view
        // instead of jumping out to a fixed level.
        const map = mapRef.current?.getMap?.();
        const zoom = Math.max(map?.getZoom?.() ?? SELECT_ZOOM, SELECT_ZOOM);

        // Long and gently eased: at 500ms the move outran tile loading, arriving
        // over blank canvas that only filled in afterwards. The slower glide gives
        // tiles time to arrive during the move, and the ease-out means the last
        // stretch — where the destination is on screen — is the slowest part.
        mapRef.current?.easeTo({
            center: [prop.coordinates.lng, prop.coordinates.lat],
            zoom,
            offset: isMobile ? [0, 0] : [0, 60],
            duration: 1100,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            essential: true,
        });
    }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

    const _propertyIndexMap = useMemo(() => {
        const map: Record<string, number> = {};
        mappableProperties.forEach((p, i) => { map[p.id] = i + 1; });
        return map;
    }, [mappableProperties]);

    const handleDragStart = useCallback(() => {
        setSelectedPoi(null);
        setActiveGemName(null);
        setSelectedNearbyPlace(null);
    }, []);

    // onStyleReady fires after style changes — re-signals isMapLoaded so pins
    // re-appear after the user switches map styles.
    const handleStyleReady = useCallback(() => {
        instanceHandleMapLoad();
    }, [instanceHandleMapLoad]);

    const handleMoveEnd = useCallback(() => {
        const zoom = mapRef.current?.getMap?.()?.getZoom?.() ?? currentZoom;
        setCurrentZoom(zoom);
        onZoomChange?.(zoom);
        setCullBounds(computeCullBounds());
    }, [onZoomChange, computeCullBounds]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedProperty = useMemo(
        () => mappableProperties.find((p: MappableProperty) => p.id === selectedId) ?? null,
        [mappableProperties, selectedId]
    );
    const hoveredProperty = useMemo(
        () => mappableProperties.find((p: MappableProperty) => p.id === hoveredId) ?? null,
        [mappableProperties, hoveredId]
    );
    const previewProperty = useMemo(() => hoveredProperty || selectedProperty, [hoveredProperty, selectedProperty]);
    const activePoi = useMemo(() => hoveredPoi || selectedPoi, [hoveredPoi, selectedPoi]);

    const poiDistance = useMemo(
        () => previewProperty && activePoi
            ? calculateDistance(previewProperty.coordinates, activePoi.coordinates)
            : null,
        [previewProperty, activePoi]
    );

    // ── Nearby places ────────────────────────────────────────────────────────
    // Radius is fixed since the panel that carried the control was removed.
    const nearbyRadius = 1000;
    const [activeGemName, setActiveGemName] = React.useState<string | null>(null);
    const [selectedNearbyPlace, setSelectedNearbyPlace] = React.useState<NearbyPlace | null>(null);

    const [gemsEnabled, setGemsEnabled] = React.useState(false);
    const gemsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(() => {
        if (gemsTimerRef.current) clearTimeout(gemsTimerRef.current);
        if (!selectedProperty) { setGemsEnabled(false); return; }
        gemsTimerRef.current = setTimeout(() => setGemsEnabled(true), 900);
        return () => { if (gemsTimerRef.current) clearTimeout(gemsTimerRef.current); };
    }, [selectedProperty?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Three categories, three calls: the endpoint takes one category per
    // request, and the hook count has to stay fixed across renders.
    const gemCoords = (isMapLoaded && selectedProperty && gemsEnabled)
        ? { lat: selectedProperty.coordinates.lat, lng: selectedProperty.coordinates.lng }
        : undefined;

    const { gems: cafeGems,    loading: cafeLoading }    = useNearbyGems({ coordinates: gemCoords, category: 'cafe',    radiusMeters: nearbyRadius });
    const { gems: medicalGems, loading: medicalLoading } = useNearbyGems({ coordinates: gemCoords, category: 'medical', radiusMeters: nearbyRadius });
    const { gems: transitGems, loading: transitLoading } = useNearbyGems({ coordinates: gemCoords, category: 'transit', radiusMeters: nearbyRadius });

    const _isFetchingGems = cafeLoading || medicalLoading || transitLoading;

    // Google and the Mapbox fallback can each return the same place, so merge on id.
    const nearbyGems = useMemo(() => {
        const byId = new Map<string, typeof cafeGems[number]>();
        for (const gem of [...cafeGems, ...medicalGems, ...transitGems]) {
            if (!byId.has(gem.id)) byId.set(gem.id, gem);
        }
        return Array.from(byId.values());
    }, [cafeGems, medicalGems, transitGems]);

    const filteredGems = useMemo(
        () => (selectedProperty ? nearbyGems : []),
        [nearbyGems, selectedProperty],
    );

    const nearbyPlaceMarkers = useMemo<NearbyPlace[]>(() =>
        filteredGems.map((gem) => ({
            name:             gem.name,
            category:         gem.category,
            lat:              gem.coordinates.lat,
            lng:              gem.coordinates.lng,
            rating:           gem.rating ?? undefined,
            userRatingsTotal: undefined,
            placeId:          gem.id,
            vicinity:         undefined,
        })),
        [filteredGems]
    );

    /**
     * The places actually drawn, which is not the places we have.
     *
     * Three `useNearbyGems` hooks feed this — one per category — and each of
     * them blanks its own list to `[]` before it refetches, lands at its own
     * moment, and then prunes low-rated entries in the background. Mirroring
     * that straight onto the map renders every intermediate state: markers
     * arrive, a slice of them unmounts when one category resets, and the same
     * discs mount and pop a second time when it comes back.
     *
     * So what is drawn is a batch of its own, with two rules. It is rebuilt
     * from scratch only when the selected hotel changes — a different hotel
     * genuinely invalidates it. For as long as one hotel stays selected it only
     * ever *gains* places: an upstream list going empty is an artefact of
     * refetching, not news that a café closed, and unmounting on it is what
     * made the batch pop in twice.
     */
    const selectedKey  = selectedProperty?.id ?? null;
    /**
     * Nothing to draw: either no hotel is selected, or the toolbar's POI toggle
     * is off. The two are the same state as far as the markers are concerned —
     * both play the exit and both rebuild from scratch on the way back — so they
     * fold into one flag rather than being tracked apart.
     */
    const poisLeaving  = !selectedKey || !showPois;
    const [drawnPlaces, setDrawnPlaces] = React.useState<DrawnPlace[]>([]);
    /** Which hotel `drawnPlaces` was built for, so a change can reset it. */
    const drawnForRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        // Hidden: hold the batch for the length of the exit — an unmounted
        // element cannot animate — then let it go.
        if (poisLeaving) {
            drawnForRef.current = null;
            const t = setTimeout(() => setDrawnPlaces([]), POI_EXIT_MS);
            return () => clearTimeout(t);
        }

        // A different hotel. The old batch describes somewhere else, so it goes
        // at once rather than merging into the new one.
        if (drawnForRef.current !== selectedKey) {
            drawnForRef.current = selectedKey;
            setDrawnPlaces(withPopOrder([], nearbyPlaceMarkers));
            return;
        }

        setDrawnPlaces(prev => withPopOrder(prev, nearbyPlaceMarkers));
    }, [poisLeaving, selectedKey, nearbyPlaceMarkers]);

    /** Blackish over the day basemap, its inverse over the night one. */
    const radiusInk = RADIUS_INK[theme];

    // The radius is the POI layer's own measurement, so it goes with them.
    const radiusCircleGeoJSON = useMemo(() => {
        if (!selectedProperty || !showPois) return null;
        return createCircleGeoJSON(
            [selectedProperty.coordinates.lng, selectedProperty.coordinates.lat],
            nearbyRadius,
        );
    }, [selectedProperty, nearbyRadius, showPois]);

    const nearbyPlaceDistanceKm = useMemo(() => {
        if (!selectedNearbyPlace || !selectedProperty) return null;
        return haversineKm(
            selectedProperty.coordinates.lat, selectedProperty.coordinates.lng,
            selectedNearbyPlace.lat, selectedNearbyPlace.lng,
        );
    }, [selectedNearbyPlace, selectedProperty]);

    const handleGemClick = useCallback((gem: NearbyGem) => {
        const name = gem.name;
        // `NearbyGem` carries `coordinates`, never a GeoJSON `geometry`; the
        // fallback these two used to have was unreachable.
        const { lng, lat } = gem.coordinates;
        if (activeGemName === name) {
            setActiveGemName(null);
            setSelectedNearbyPlace(null);
            return;
        }
        setActiveGemName(name);
        setSelectedNearbyPlace({
            name, category: gem.category || 'place', lat, lng,
            rating: gem.rating ?? undefined, userRatingsTotal: undefined,
            placeId: gem.id, vicinity: undefined,
        });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, pitch: 30, duration: 600 });
    }, [activeGemName, mapRef]);

    React.useEffect(() => {
        if (!selectedId) {
            setActiveGemName(null);
            setSelectedNearbyPlace(null);
        }
    }, [selectedId]);

    // GPS route for clicked POI
    React.useEffect(() => {
        if (!previewProperty || !selectedPoi) {
            setRouteGeometry(null);
            setCarDuration(null);
            setWalkDuration(null);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const base = `https://api.mapbox.com/directions/v5/mapbox`;
                const coords = `${previewProperty.coordinates.lng},${previewProperty.coordinates.lat};${selectedPoi.coordinates.lng},${selectedPoi.coordinates.lat}`;
                const token = `access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
                const signal = controller.signal;

                const [drivingJson, walkingJson] = await Promise.all([
                    fetch(`${base}/driving/${coords}?geometries=geojson&overview=full&${token}`, { signal }).then(r => r.json()),
                    fetch(`${base}/walking/${coords}?overview=full&${token}`, { signal }).then(r => r.json()),
                ]);

                if (drivingJson.code === 'Ok' && drivingJson.routes?.length) {
                    const route = drivingJson.routes[0];
                    setRouteGeometry(route.geometry);
                    setCarDuration(`${Math.max(1, Math.round(route.duration / 60))} min`);
                }
                if (walkingJson.code === 'Ok' && walkingJson.routes?.length) {
                    const route = walkingJson.routes[0];
                    setWalkDuration(`${Math.max(1, Math.round(route.duration / 60))} min`);
                }
            } catch (err) {
                if (!isAbortError(err)) console.error('Directions error:', err);
            }
        }, 400);

        return () => { clearTimeout(timer); controller.abort(); };
    }, [previewProperty, selectedPoi]);

    const poiRouteData = useMemo(() => routeGeometry ? ({
        type: 'Feature' as const,
        properties: {},
        geometry: routeGeometry
    }) : null, [routeGeometry]);

    const {
        mapType, setMapType, showDetailsPanel, setShowDetailsPanel,
        showLabels, setShowLabels, mapDetails, handleDetailToggle,
        terrainEnabled, mapStyleUrl, standardConfig,
    } = useMapDetails('default');

    /**
     * Light and dark come from Standard's `lightPreset`, not from swapping
     * style URLs.
     *
     * That is the whole point of using Standard here: a preset change is a
     * config write the running style applies in place, where a URL change tears
     * the style down, refetches it, and hides every pin until the map goes idle
     * again — which is what made the theme toggle stutter.
     *
     * Buildings and road labels are on: the flat `dark-v11`/`light-v11` basemaps
     * gave streets and structures almost no presence at city zooms.
     */
    const searchStandardConfig = React.useMemo(() => ({
        ...standardConfig,
        lightPreset: (theme === 'dark' ? 'night' : 'day') as 'night' | 'day',
        show3dObjects: true,
        show3dBuildings: true,
        show3dLandmarks: true,
        show3dFacades: false,
        show3dTrees: false,
        showRoadLabels: true,
        showPlaceLabels: true,
        // Our own POI discs cover this ground; Mapbox's labels would double up.
        showPointOfInterestLabels: false,
    }), [standardConfig, theme]);

    /**
     * Standard for the default view. Satellite and the 3D type keep their own
     * style URLs.
     */
    const themedMapStyle = React.useMemo(
        () => (mapType === 'default' ? 'standard' : mapStyleUrl),
        [mapType, mapStyleUrl]
    );

    const prevMapStyleRef = React.useRef<string | undefined>();
    React.useEffect(() => {
        if (prevMapStyleRef.current !== undefined && prevMapStyleRef.current !== themedMapStyle) {
            handleMapStyleChange();
        }
        prevMapStyleRef.current = themedMapStyle;
    }, [themedMapStyle, handleMapStyleChange]);

    const initialViewState = useMemo(() => {
        // Always prefer the explicit search coordinates from the URL (lat/lng from
        // autocomplete). The bbox center can land in the sea for coastal cities.
        const lng = defaultCenter?.lng ?? (districtBbox ? (districtBbox[0] + districtBbox[2]) / 2 : 139.6917);
        const lat = defaultCenter?.lat ?? (districtBbox ? (districtBbox[1] + districtBbox[3]) / 2 : 35.6895);
        return { longitude: lng, latitude: lat, zoom: 12, pitch: 0, bearing: 0 };
    }, [defaultCenter?.lat, defaultCenter?.lng, districtBbox]);

    return (
        <div className="relative h-full w-full">
            <MapContainer
                mapRef={mapRef}
                mapStyle={themedMapStyle}
                standardConfig={themedMapStyle === 'standard' ? searchStandardConfig : undefined}
                enable3DTerrain={terrainEnabled}
                antialias={!isMobile}
                maxPitch={85}
                initialViewState={initialViewState}
                onLoad={handleMapLoad}
                onStyleReady={handleStyleReady}
                onClick={handleMapClick}
                onMouseMove={onMouseMove}
                onDragStart={handleDragStart}
                onMoveEnd={handleMoveEnd}
                hideLayersButton={true}
                topViewOnly={true}
            >
                <>
                        {/* Loading placeholder pins — ghost circles while hotels arrive */}
                        {isSearching && mappableProperties.length === 0 && loadingPinCenter && (
                            LOADING_PIN_OFFSETS.map((offset, i) => (
                                <Marker
                                    key={`loading-pin-${i}`}
                                    longitude={loadingPinCenter.lng + offset.lng}
                                    latitude={loadingPinCenter.lat + offset.lat}
                                    anchor="bottom"
                                >
                                    <div className="flex flex-col items-center" style={{ opacity: 0.75 }}>
                                        <div
                                            className="animate-pulse"
                                            style={{
                                                width: 48, height: 48,
                                                borderRadius: '50%',
                                                border: '2.5px solid white',
                                                background: 'linear-gradient(135deg, #c7d2fe 0%, #ddd6fe 100%)',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                                                animationDelay: `${i * 0.15}s`,
                                            }}
                                        />
                                        <div style={{
                                            marginTop: 3,
                                            background: 'white',
                                            borderRadius: 10,
                                            padding: '2px 8px',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            boxShadow: '0 1px 5px rgba(0,0,0,0.12)',
                                            lineHeight: '1.5',
                                        }}>
                                            <span style={{ letterSpacing: '0.2em', color: '#aaa' }}>···</span>
                                        </div>
                                    </div>
                                </Marker>
                            ))
                        )}

                        {/* Hotel pins rendered imperatively via mapboxgl.Marker — see useEffect above */}

                        {radiusCircleGeoJSON && (
                            <Source id="nearby-radius" type="geojson" data={radiusCircleGeoJSON}>
                                <Layer id="nearby-radius-fill" type="fill"
                                    paint={{ 'fill-color': radiusInk, 'fill-opacity': 0.07 }} />
                                <Layer id="nearby-radius-outline" type="line"
                                    paint={{ 'line-color': radiusInk, 'line-width': 1.5, 'line-opacity': 0.34, 'line-dasharray': [3, 2] }} />
                            </Source>
                        )}

                        {drawnPlaces.map((place) => (
                            <NearbyPlaceMarker
                                // The same key the batch dedupes on, so the two
                                // can never disagree about what one place is.
                                key={placeKey(place)}
                                place={place}
                                index={place.popIndex}
                                leaving={poisLeaving}
                                isSelected={activeGemName === place.name}
                                onClick={(p) => {
                                    const gem = filteredGems.find(g => g.name === p.name);
                                    if (gem) handleGemClick(gem);
                                }}
                            />
                        ))}

                        {poiRouteData && (
                            <Source id="poi-route-source" type="geojson" data={poiRouteData}>
                                <Layer id="poi-route-layer" type="line"
                                    paint={{ 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 1 }} />
                            </Source>
                        )}

                        {(selectedPoi || (hoveredPoi && !selectedPoi)) && (
                            <PoiPopup
                                poi={hoveredPoi || selectedPoi!}
                                distance={poiDistance ? `${poiDistance} km` : undefined}
                                carDuration={selectedPoi ? carDuration : null}
                                walkDuration={selectedPoi ? walkDuration : null}
                                onClose={() => setSelectedPoi(null)}
                            />
                        )}
                </>

                <SelectedPropertyPopup
                    selectedProperty={selectedProperty}
                    onClose={() => {
                        onSelectId(null);
                        setSelectedPoi(null);
                        setActiveGemName(null);
                        setSelectedNearbyPlace(null);
                    }}
                    onViewDetails={onViewDetails}
                    onSelect={(id) => onSelectId(id)}
                    isMobile={isMobile}
                    nights={nights}
                />

                {selectedNearbyPlace && (
                    <NearbyPlacePopup
                        place={selectedNearbyPlace}
                        distanceKm={nearbyPlaceDistanceKm}
                        onClose={() => {
                            setSelectedNearbyPlace(null);
                            setActiveGemName(null);
                        }}
                    />
                )}
            </MapContainer>

            {/* Map Search Overlay */}
            <MapSearchOverlay
                className={searchOverlayClassName || 'absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[60%] sm:w-[320px] md:w-[400px]'}
                onSelect={(r) => {
                    mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 15, pitch: 45, bearing: -10, duration: 1200 });
                    const params = new URLSearchParams(window.location.search);
                    params.set('destination', r.name);
                    params.set('lat', r.lat.toString());
                    params.set('lng', r.lng.toString());
                    router.push(`/search?${params.toString()}`);
                }}
            />

            {/* Map Details Panel — no longer reachable from this map: the Layers
                button that opened it collided with the page's back button. */}
            <MapDetailsPanel
                isOpen={showDetailsPanel}
                onClose={() => setShowDetailsPanel(false)}
                mapType={mapType}
                onMapTypeChange={setMapType}
                details={mapDetails}
                onDetailToggle={handleDetailToggle}
                showLabels={showLabels}
                onLabelsToggle={() => setShowLabels((prev) => !prev)}
            />
        </div>
    );
});


// `React.memo` returns an anonymous object, so React DevTools and the
// react/display-name rule both need the name spelled out.
SearchMapContainer.displayName = 'SearchMapContainer';
