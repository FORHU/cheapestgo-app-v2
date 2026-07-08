'use client';

import * as React from 'react';
import MapboxMap, {
    type MapRef,
    type MapProps as MapboxMapProps,
    Source,
    Layer,
} from 'react-map-gl/mapbox';
import { cn } from '@/shared/lib/cn';
import { env } from '@/shared/lib/env';

/** Standard style config properties */
export interface StandardStyleConfig {
    lightPreset?: 'dawn' | 'day' | 'dusk' | 'night';
    theme?: 'default' | 'faded' | 'monochrome';
    show3dObjects?: boolean;
    show3dBuildings?: boolean;
    show3dTrees?: boolean;
    show3dLandmarks?: boolean;
    show3dFacades?: boolean;
    showPlaceLabels?: boolean;
    showPointOfInterestLabels?: boolean;
    showRoadLabels?: boolean;
    showTransitLabels?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showCycling?: boolean;
    showPedestrianRoads?: boolean;
    language?: string;
    colorBuildings?: string;
    colorLand?: string;
    colorWater?: string;
    colorRoads?: string;
}

interface MapProps extends Omit<MapboxMapProps, 'mapStyle' | 'terrain'> {
    className?: string;
    mapStyle?: 'standard' | string;
    standardConfig?: StandardStyleConfig;
    enable3DTerrain?: boolean;
    terrainExaggeration?: number;
    enable3DBuildings?: boolean;
    buildingColor?: string;
    buildingOpacity?: number;
    antialias?: boolean;
    onStyleReady?: (map: mapboxgl.Map) => void;
}

function Buildings3DLayer({
    color = '#aaa',
    opacity = 0.8,
    beforeId,
}: {
    color?: string;
    opacity?: number;
    beforeId?: string;
}) {
    return (
        <Layer
            id="3d-buildings"
            beforeId={beforeId}
            source="composite"
            source-layer="building"
            filter={['==', 'extrude', 'true']}
            type="fill-extrusion"
            minzoom={15}
            paint={{
                'fill-extrusion-color': color,
                'fill-extrusion-height': [
                    'interpolate', ['linear'], ['zoom'], 15, 0, 15.5, ['get', 'height'],
                ],
                'fill-extrusion-base': [
                    'interpolate', ['linear'], ['zoom'], 15, 0, 15.5, ['get', 'min_height'],
                ],
                'fill-extrusion-opacity': [
                    'interpolate', ['linear'], ['zoom'], 15, 0, 15.5, opacity,
                ],
            }}
        />
    );
}

const STANDARD_STYLE_URL = 'mapbox://styles/mapbox/standard';

const Map = React.memo(
    React.forwardRef<MapRef, MapProps>(
        (
            {
                className,
                mapStyle = 'standard',
                standardConfig,
                enable3DTerrain = false,
                terrainExaggeration = 1.5,
                enable3DBuildings = false,
                buildingColor = '#aaa',
                buildingOpacity = 0.8,
                antialias = false,
                children,
                onLoad,
                onStyleReady,
                ...props
            },
            ref
        ) => {
            const isStandard = mapStyle === 'standard';
            const internalRef = React.useRef<MapRef>(null);
            const mapRef = (ref as React.RefObject<MapRef | null>) || internalRef;
            const [isStyleLoaded, setIsStyleLoaded] = React.useState(false);
            const [mapReady, setMapReady] = React.useState(false);
            const [firstSymbolId, setFirstSymbolId] = React.useState<string>();
            const cursorPatchedRef = React.useRef(false);

            React.useEffect(() => {
                const map = mapRef.current?.getMap();
                if (!map || !mapReady) return;

                setIsStyleLoaded(false);

                const setup = () => {
                    if (!map || !map.getStyle()) return;

                    try {
                        const style = map.getStyle();

                        if (!isStandard && style?.layers) {
                            style.layers.forEach((layer: any) => {
                                if (layer.type === 'symbol' && layer.layout?.['text-field']) {
                                    map.setLayoutProperty(layer.id, 'text-field', [
                                        'coalesce', ['get', 'name_en'], ['get', 'name'],
                                    ]);
                                }
                            });
                        }

                        if (style?.layers) {
                            const firstSymbol = style.layers.find((l) => l.type === 'symbol');
                            if (firstSymbol) setFirstSymbolId(firstSymbol.id);
                        }

                        if (isStandard && standardConfig) {
                            Object.entries(standardConfig).forEach(([key, value]) => {
                                if (value !== undefined) {
                                    try {
                                        const current = (map as any).getConfigProperty?.('basemap', key);
                                        if (current !== value) map.setConfigProperty('basemap', key, value);
                                    } catch { /* Ignore errors during initial burst */ }
                                }
                            });
                        }

                        if (!isStandard) {
                            if (enable3DTerrain) {
                                if (!map.getSource('mapbox-dem')) {
                                    map.addSource('mapbox-dem', {
                                        type: 'raster-dem',
                                        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                                        tileSize: 512,
                                        maxzoom: 14,
                                    });
                                }
                                map.setTerrain({ source: 'mapbox-dem', exaggeration: terrainExaggeration });
                            } else {
                                try {
                                    if (map.getTerrain()) map.setTerrain(null);
                                } catch { /* Ignore if style not ready */ }
                            }
                        }

                        setTimeout(() => {
                            if (map.getStyle()) {
                                setIsStyleLoaded(true);
                                onStyleReady?.(map);
                            }
                        }, 0);
                    } catch (err) {
                        console.warn('Map setup failed, retrying...', err);
                        setTimeout(setup, 300);
                    }
                };

                if (map.isStyleLoaded()) {
                    setup();
                } else {
                    map.once('style.load', setup);

                    let attempts = 0;
                    const poll = setInterval(() => {
                        attempts++;
                        if (map.isStyleLoaded()) {
                            clearInterval(poll);
                            map.off('style.load', setup);
                            setup();
                        } else if (attempts >= 20) {
                            clearInterval(poll);
                        }
                    }, 250);

                    return () => {
                        clearInterval(poll);
                        map.off('style.load', setup);
                    };
                }
            }, [mapStyle, mapReady, isStandard, enable3DTerrain, terrainExaggeration]);

            const handleLoad = React.useCallback(
                (e: mapboxgl.MapboxEvent) => {
                    setMapReady(true);
                    onLoad?.(e);
                },
                [onLoad]
            );

            React.useEffect(() => {
                if (!mapReady || cursorPatchedRef.current) return;
                const map = mapRef.current?.getMap();
                if (!map) return;

                const container = map.getContainer();
                cursorPatchedRef.current = true;

                const restoreCursor = () => {
                    const canvases = container.querySelectorAll<HTMLCanvasElement>('canvas');
                    canvases.forEach(c => {
                        if (c.style.cursor === '' || c.style.cursor === 'auto') {
                            c.style.cursor = 'grab';
                        }
                    });
                };

                restoreCursor();
                container.addEventListener('mousemove', restoreCursor);
                container.addEventListener('mouseenter', restoreCursor);

                return () => {
                    container.removeEventListener('mousemove', restoreCursor);
                    container.removeEventListener('mouseenter', restoreCursor);
                    cursorPatchedRef.current = false;
                };
            }, [mapReady, mapRef]);

            const lastConfigRef = React.useRef<string>('');
            React.useEffect(() => {
                if (!isStandard || !standardConfig || !isStyleLoaded) return;

                const map = mapRef.current?.getMap();
                if (!map) return;

                const configStr = JSON.stringify(standardConfig);
                if (configStr === lastConfigRef.current) return;
                lastConfigRef.current = configStr;

                try {
                    if (!map.isStyleLoaded()) return;

                    Object.entries(standardConfig).forEach(([key, value]) => {
                        if (value !== undefined) {
                            try {
                                if (!map.isStyleLoaded()) return;
                                const current = (map as any).getConfigProperty?.('basemap', key);
                                if (current !== value) map.setConfigProperty('basemap', key, value);
                            } catch { /* Ignore */ }
                        }
                    });
                } catch (err) {
                    console.warn('Failed to update config property', err);
                }
            }, [isStandard, standardConfig, isStyleLoaded, mapRef]);

            const resolvedStyle = isStandard ? STANDARD_STYLE_URL : mapStyle;

            const token = env.NEXT_PUBLIC_MAPBOX_TOKEN;

            return (
                <div
                    className={cn(
                        'relative w-full h-full min-h-[200px] rounded-lg overflow:clip cursor-grab active:cursor-grabbing',
                        className
                    )}
                >
                    <MapboxMap
                        ref={mapRef as React.RefObject<MapRef>}
                        mapboxAccessToken={token}
                        mapStyle={resolvedStyle as MapboxMapProps['mapStyle']}
                        onLoad={handleLoad}
                        antialias={antialias}
                        {...props}
                    >
                        {isStyleLoaded && (
                            <>
                                {!isStandard && enable3DTerrain && (
                                    <Source
                                        id="mapbox-dem"
                                        type="raster-dem"
                                        url="mapbox://mapbox.mapbox-terrain-dem-v1"
                                        tileSize={512}
                                        maxzoom={14}
                                    />
                                )}
                                {!isStandard && enable3DBuildings && (
                                    <Buildings3DLayer
                                        color={buildingColor}
                                        opacity={buildingOpacity}
                                        beforeId={firstSymbolId}
                                    />
                                )}
                                {children}
                            </>
                        )}
                    </MapboxMap>
                </div>
            );
        }
    )
);

Map.displayName = 'Map';

export { Map, Buildings3DLayer };
export type { MapProps };
