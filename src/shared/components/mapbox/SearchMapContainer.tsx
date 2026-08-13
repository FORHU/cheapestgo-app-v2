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
import { MapPopup } from '@/shared/components/map/MapPopup';
import { MapSearchOverlay } from './components/MapSearchOverlay';
import { useRouter } from 'next/navigation';
import { useUserCurrency } from '@/stores/searchStore';
import { convertCurrency } from '@/shared/lib/currency';
import { useMapDetails } from './hooks/useMapDetails';
import { MapDetailsPanel } from './components/MapDetailsPanel';
import { env } from '@/shared/lib/env';
import { Layers } from 'lucide-react';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';
import { cn, } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';
import { MapGemsPanel } from '@/shared/components/map/MapGemsPanel';
import { NearbyPlaceMarker } from '@/shared/components/map/NearbyPlaceMarker';
import { NearbyPlacePopup } from '@/shared/components/map/NearbyPlacePopup';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
import type { NearbyPlace } from '@/shared/components/map/useMapNearbyPlaces';

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

function createCircleGeoJSON(center: [number, number], radiusMeters: number): any {
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
    cityName,
    onZoomChange,
    showAllProperties,
}: SearchMapContainerProps) => {
    const { mapRef, isMapLoaded, isMapIdle, handleMapLoad: instanceHandleMapLoad, handleMapStyleChange } = useMapboxInstance();
    const isMobile = useIsMobile();
    const router = useRouter();
    const targetCurrency = useUserCurrency();

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
            prices[p.id] = convertCurrency(p.price, p.currency || 'USD', targetCurrency);
        }
        return prices;
    }, [mappableProperties, targetCurrency]);

    const displayPrices = useMemo(() => {
        const formatted: Record<string, string> = {};
        for (const p of mappableProperties) {
            formatted[p.id] = formatCurrency(markerPrices[p.id] || 0, targetCurrency);
        }
        return formatted;
    }, [mappableProperties, markerPrices, targetCurrency]);

    const [currentZoom, setCurrentZoom] = React.useState(11);
    const districtFitDoneRef = React.useRef(false);

    // Wrap the load handler so we can call fitBounds synchronously on the raw
    // map instance (via e.target) BEFORE any React state update triggers
    // re-renders — the most reliable way to zoom to the district bbox.
    const handleMapLoad = useCallback((e?: any) => {
        if (districtBbox && !districtFitDoneRef.current) {
            districtFitDoneRef.current = true;
            const rawMap = e?.target ?? mapRef.current?.getMap?.();
            if (rawMap) {
                const [minLng, minLat, maxLng, maxLat] = districtBbox;
                rawMap.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 15, duration: 0 });
            }
        }
        instanceHandleMapLoad();
    }, [districtBbox, instanceHandleMapLoad]); // eslint-disable-line react-hooks/exhaustive-deps

    const markerProperties = useMemo(() => {
        if (!districtBbox || showAllProperties || currentZoom < DISTRICT_MARKER_THRESHOLD) return mappableProperties;
        const [minLng, minLat, maxLng, maxLat] = districtBbox;
        return mappableProperties.filter(p =>
            p.coordinates.lng >= minLng && p.coordinates.lng <= maxLng &&
            p.coordinates.lat >= minLat && p.coordinates.lat <= maxLat
        );
    }, [mappableProperties, districtBbox, currentZoom, showAllProperties]);

    const [selectedPoi, setSelectedPoi] = React.useState<PoiData | null>(null);
    const [hoveredPoi, setHoveredPoi] = React.useState<PoiData | null>(null);

    const [routeGeometry, setRouteGeometry] = React.useState<any>(null);
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
    }, [isMapLoaded, attachMouseLeave]);

    useMapViewport({ mapRef, isMapLoaded, properties: mappableProperties, center: defaultCenter, selectedId, disableFlyToSelected: true, skipInitialFit: !!districtBbox });


    // ── Imperative hotel pin markers ─────────────────────────────────────────
    // We bypass react-map-gl's Marker portal system (which silently fails to
    // paint pins after the map style finishes loading) and create raw
    // mapboxgl.Marker instances directly. createRoot renders React content
    // into each marker's DOM element so the pin visuals still come from React.
    type MarkerEntry = { marker: any; root: Root; el: HTMLDivElement; visible: boolean };
    const imperativeMarkersRef = React.useRef<Map<string, MarkerEntry>>(new Map());
    // mapbox-gl Marker class, loaded once on mount. Kept in state so the
    // marker effect re-fires if it ran before the dynamic import resolved.
    const [MapboxMarkerClass, setMapboxMarkerClass] = React.useState<any>(null);

    React.useEffect(() => {
        import('mapbox-gl').then((mod) => {
            const Cls = (mod as any).Marker ?? (mod as any).default?.Marker ?? null;
            // Wrap in arrow so React doesn't treat the class as a setState updater
            setMapboxMarkerClass(() => Cls);
        }).catch(() => { /* ignore */ });
    }, []);

    // Stable refs for callbacks — avoids recreating markers when parent re-renders
    const onSelectIdRef = React.useRef(onSelectId);
    const onHoverIdRef  = React.useRef(onHoverId);
    React.useEffect(() => { onSelectIdRef.current = onSelectId; }, [onSelectId]);
    React.useEffect(() => { onHoverIdRef.current  = onHoverId;  }, [onHoverId]);

    React.useEffect(() => {
        if (!isMapLoaded || !isMapIdle) return;
        const mapInstance = mapRef.current?.getMap?.();
        if (!mapInstance) return;

        const MapboxMarker = MapboxMarkerClass;
        if (!MapboxMarker) return;

        const renderPin = (root: Root, p: MappableProperty, isHov: boolean) => {
            const image = p.image ?? p.images?.[0];
            const borderColor = isHov ? '#93c5fd' : 'white';
            const shadow = isHov ? '0 4px 14px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.25)';
            const price = markerPrices[p.id] ?? 0;
            let priceLabel = '';
            try { priceLabel = price > 0 ? formatCurrency(price, targetCurrency) : ''; } catch { /* noop */ }
            root.render(
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    transform: isHov ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: 'center 48px',
                    transition: 'transform 150ms ease',
                    pointerEvents: 'none',
                }}>
                    {/* Spacer matches price-label height so element center = circle center */}
                    <div style={{ height: 24, flexShrink: 0 }} />
                    <div style={{
                        width: 48, height: 48, minWidth: 48, minHeight: 48,
                        borderRadius: '50%', overflow: 'hidden',
                        border: `2.5px solid ${borderColor}`,
                        boxShadow: shadow,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        flexShrink: 0,
                    }}>
                        {image && (
                            <img src={image} alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        )}
                    </div>
                    <div style={{
                        marginTop: 3, background: 'white', color: '#111',
                        borderRadius: 10, padding: '2px 8px', fontSize: 11,
                        fontWeight: 700, whiteSpace: 'nowrap',
                        boxShadow: '0 1px 5px rgba(0,0,0,0.18)', lineHeight: '1.5',
                        minWidth: 32, textAlign: 'center',
                    }}>
                        {priceLabel
                            ? priceLabel
                            : <span style={{ letterSpacing: '0.2em', color: '#999' }}>···</span>}
                    </div>
                </div>
            );
        };

        const currentIds = new Set(markerProperties.map(p => p.id));

        // Remove markers for hotels no longer in results.
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

        for (const p of markerProperties) {
            const isSelected = p.id === selectedId;
            const isHov     = p.id === hoveredId;
            const existing  = imperativeMarkersRef.current.get(p.id);

            if (!existing) {
                // Create new marker
                const el = document.createElement('div');
                el.style.cursor = 'pointer';
                el.style.zIndex = isHov ? '10' : '1';
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSelectIdRef.current(p.id);
                });
                el.addEventListener('mouseenter', () => onHoverIdRef.current(p.id));
                el.addEventListener('mouseleave', () => onHoverIdRef.current(null));

                const root = createRoot(el);
                renderPin(root, p, isHov);

                const marker = new MapboxMarker({ element: el, anchor: 'center' })
                    .setLngLat([p.coordinates.lng, p.coordinates.lat]);

                if (!isSelected) marker.addTo(mapInstance);

                imperativeMarkersRef.current.set(p.id, { marker, root, el, visible: !isSelected });
            } else {
                // Update visibility for selection changes
                if (isSelected && existing.visible) {
                    existing.marker.remove();
                    existing.visible = false;
                } else if (!isSelected && !existing.visible) {
                    existing.marker.addTo(mapInstance);
                    existing.visible = true;
                }
                // Update pin content for hover / price changes
                renderPin(existing.root, p, isHov);
                existing.el.style.zIndex = isHov ? '10' : '1';
            }
        }
    }, [isMapLoaded, isMapIdle, MapboxMarkerClass, markerProperties, selectedId, hoveredId, markerPrices, targetCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup all imperative markers on unmount
    React.useEffect(() => {
        const markersRef = imperativeMarkersRef;
        return () => {
            for (const { marker, root } of markersRef.current.values()) {
                try { marker.remove(); } catch { /* noop */ }
                try { root.unmount(); } catch { /* noop */ }
            }
            markersRef.current.clear();
        };
    }, []);
    // ─────────────────────────────────────────────────────────────────────────

    React.useEffect(() => {
        if (!selectedId || !isMapLoaded) return;
        const prop = mappableProperties.find(p => p.id === selectedId);
        if (!prop) return;
        // Pan only — no zoom change. Keeps tiles already loaded at fitBounds level,
        // avoiding the dark-background flash from loading new tiles at a higher zoom.
        mapRef.current?.easeTo({
            center: [prop.coordinates.lng, prop.coordinates.lat],
            offset: isMobile ? [0, 0] : [0, 60],
            duration: 500,
            essential: true,
        });
    }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

    const propertyIndexMap = useMemo(() => {
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
    }, [onZoomChange]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // ── Nearby Gems (stubbed — POI task handles real fetching) ────────────────
    const [nearbyCategory, setNearbyCategory] = React.useState('all');
    const [nearbyRadius, setNearbyRadius] = React.useState(1000);
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

    const { gems: nearbyGems, loading: isFetchingGems } = useNearbyGems({
        coordinates: (isMapLoaded && selectedProperty && gemsEnabled)
            ? { lat: selectedProperty.coordinates.lat, lng: selectedProperty.coordinates.lng }
            : undefined,
        category: nearbyCategory as any,
        radiusMeters: nearbyRadius,
    });

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

    const radiusCircleGeoJSON = useMemo(() => {
        if (!selectedProperty) return null;
        return createCircleGeoJSON(
            [selectedProperty.coordinates.lng, selectedProperty.coordinates.lat],
            nearbyRadius,
        );
    }, [selectedProperty, nearbyRadius]);

    const nearbyPlaceDistanceKm = useMemo(() => {
        if (!selectedNearbyPlace || !selectedProperty) return null;
        return haversineKm(
            selectedProperty.coordinates.lat, selectedProperty.coordinates.lng,
            selectedNearbyPlace.lat, selectedNearbyPlace.lng,
        );
    }, [selectedNearbyPlace, selectedProperty]);

    const handleGemClick = useCallback((gem: any) => {
        const name = gem.name;
        const lng  = gem.coordinates?.lng ?? gem.geometry?.coordinates[0];
        const lat  = gem.coordinates?.lat ?? gem.geometry?.coordinates[1];
        if (activeGemName === name) {
            setActiveGemName(null);
            setSelectedNearbyPlace(null);
            return;
        }
        setActiveGemName(name);
        setSelectedNearbyPlace({
            name, category: gem.category || 'place', lat, lng,
            rating: gem.rating, userRatingsTotal: undefined,
            placeId: gem.id, vicinity: undefined,
        });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, pitch: 30, duration: 600 });
    }, [activeGemName]);

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
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error('Directions error:', err);
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

    const searchStandardConfig = React.useMemo(() => ({
        ...standardConfig,
        show3dObjects: false,
        show3dBuildings: false,
        show3dFacades: false,
        show3dTrees: false,
        show3dLandmarks: false,
        lightPreset: 'day' as const,
    }), [standardConfig]);

    const prevMapStyleRef = React.useRef<string | undefined>();
    React.useEffect(() => {
        if (prevMapStyleRef.current !== undefined && prevMapStyleRef.current !== mapStyleUrl) {
            handleMapStyleChange();
        }
        prevMapStyleRef.current = mapStyleUrl;
    }, [mapStyleUrl, handleMapStyleChange]);

    const initialViewState = useMemo(() => {
        if (districtBbox) {
            const [minLng, minLat, maxLng, maxLat] = districtBbox;
            return {
                longitude: (minLng + maxLng) / 2,
                latitude: (minLat + maxLat) / 2,
                zoom: 14,
                pitch: 0,
                bearing: 0,
            };
        }
        return {
            longitude: defaultCenter?.lng ?? 139.6917,
            latitude: defaultCenter?.lat ?? 35.6895,
            zoom: 12,
            pitch: 0,
            bearing: 0,
        };
    }, [defaultCenter?.lat, defaultCenter?.lng, districtBbox]);

    return (
        <div className="relative h-full w-full">
            <MapContainer
                mapRef={mapRef}
                mapStyle={mapStyleUrl}
                standardConfig={mapType === 'default-3d' ? searchStandardConfig : undefined}
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
                                    paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.06 }} />
                                <Layer id="nearby-radius-outline" type="line"
                                    paint={{ 'line-color': '#3b82f6', 'line-width': 1.5, 'line-opacity': 0.35, 'line-dasharray': [3, 2] }} />
                            </Source>
                        )}

                        {selectedProperty && nearbyPlaceMarkers.map((place) => (
                            <NearbyPlaceMarker
                                key={`${place.name}-${place.lat}-${place.lng}`}
                                place={place}
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

            {/* District zoom-out banner — shown when user zooms out past district threshold */}
            {districtBbox && currentZoom < DISTRICT_MARKER_THRESHOLD && cityName && (
                <div style={{
                    position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 35, pointerEvents: 'none',
                }}>
                    <div style={{
                        background: 'rgba(28,23,36,0.92)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 100,
                        padding: '8px 18px',
                        fontSize: 13,
                        color: '#F5EFE4',
                        backdropFilter: 'blur(10px)',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
                    }}>
                        Showing all hotels in {cityName}
                    </div>
                </div>
            )}

            {/* Mobile centered property preview */}
            {isMobile && selectedProperty && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-60 w-[min(200px,calc(100vw-48px))] pointer-events-auto">
                    <div className="relative">
                        <MapPopup
                            property={selectedProperty}
                            onClose={() => {
                                onSelectId(null);
                                setSelectedPoi(null);
                                setActiveGemName(null);
                                setSelectedNearbyPlace(null);
                            }}
                            onViewDetails={onViewDetails}
                            isCentered={true}
                        />
                    </div>
                </div>
            )}

            {/* Nearby Gems Panel */}
            {selectedProperty && (
                <div className="absolute bottom-2 left-2 right-2 z-10">
                    <MapGemsPanel
                        gems={filteredGems}
                        isLoading={isFetchingGems}
                        selectedCategory={nearbyCategory}
                        onCategoryChange={(cat) => {
                            setNearbyCategory(cat);
                            setActiveGemName(null);
                            setSelectedNearbyPlace(null);
                        }}
                        radiusMeters={nearbyRadius}
                        onRadiusChange={setNearbyRadius}
                        activeGemName={activeGemName}
                        onGemClick={handleGemClick}
                    />
                </div>
            )}

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

            {/* Layers button */}
            {!showDetailsPanel && (
                <button
                    onClick={(e) => { e.stopPropagation(); setShowDetailsPanel(true); }}
                    className={cn(
                        'absolute left-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-md shadow-lg border border-slate-200 dark:border-slate-700 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 group h-[30px] shrink-0',
                        'top-[58px] lg:top-4'
                    )}
                >
                    <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300 group-hover:text-blue-500 transition-colors" strokeWidth={2} />
                    <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                    <svg className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            )}

            {/* Map Details Panel */}
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
