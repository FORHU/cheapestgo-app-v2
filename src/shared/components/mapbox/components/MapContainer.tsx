import { Map, type StandardStyleConfig } from '@/shared/components/ui/map';
import { NavigationControl, AttributionControl, MapRef } from 'react-map-gl/mapbox';
import { Layers } from 'lucide-react';
import { MapDetailsPanel } from './MapDetailsPanel';
import { useMapDetails } from '../hooks/useMapDetails';

interface MapContainerProps {
    mapRef: React.RefObject<MapRef | null>;
    initialViewState: {
        longitude: number;
        latitude: number;
        zoom: number;
        pitch?: number;
        bearing?: number;
    };
    onLoad: (e: any) => void;
    onClick: (e: any) => void;
    onMouseMove: (e: any) => void;
    onMove?: (e: any) => void;
    onMoveEnd?: (e: any) => void;
    onDragStart?: (e: any) => void;
    children?: React.ReactNode;
    /**
     * When true the Layers button and MapDetailsPanel are NOT rendered.
     * Pass this when the parent already owns the panel (e.g. SearchMapContainer).
     */
    hideLayersButton?: boolean;
    mapStyle?: string;
    standardConfig?: StandardStyleConfig;
    enable3DTerrain?: boolean;
    antialias?: boolean;
    maxPitch?: number;
    onStyleReady?: (map: mapboxgl.Map) => void;
}

export const MapContainer = ({
    mapRef,
    initialViewState,
    onLoad,
    onClick,
    onMouseMove,
    onMove,
    onMoveEnd,
    onDragStart,
    children,
    hideLayersButton = false,
    mapStyle: propMapStyle,
    standardConfig: propStandardConfig,
    enable3DTerrain: propEnable3DTerrain,
    antialias: propAntialias,
    maxPitch: propMaxPitch,
    onStyleReady,
}: MapContainerProps) => {
    const internal = useMapDetails();

    const finalMapStyle       = propMapStyle       ?? internal.mapStyleUrl;
    const finalStandardConfig = propStandardConfig ?? (internal.mapType === 'default-3d' ? internal.standardConfig : undefined);
    const finalTerrainEnabled = propEnable3DTerrain ?? internal.terrainEnabled;

    return (
        <Map
            ref={mapRef as React.RefObject<MapRef>}
            mapStyle={finalMapStyle}
            standardConfig={finalStandardConfig}
            enable3DTerrain={finalTerrainEnabled}
            terrainExaggeration={1.5}
            initialViewState={{
                pitch: 20,
                bearing: -10,
                ...initialViewState,
            }}
            maxPitch={propMaxPitch ?? 85}
            onClick={onClick}
            onMouseMove={onMouseMove}
            onMove={onMove}
            onMoveEnd={onMoveEnd}
            onDragStart={onDragStart}
            onLoad={onLoad}
            onStyleReady={onStyleReady}
            enable3DBuildings={false}
            antialias={propAntialias ?? false}
            attributionControl={false}
            className="rounded-md min-h-0 w-full h-full"
        >
            <NavigationControl position="top-right" showCompass visualizePitch />
            <AttributionControl position="top-right" compact />
            {children}

            {!hideLayersButton && (
                <>
                    {!internal.showDetailsPanel && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                internal.setShowDetailsPanel(true);
                            }}
                            className="absolute top-4 left-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 group h-[38px]"
                        >
                            <Layers className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover:text-blue-500 transition-colors" />
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                            <svg className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    )}

                    <MapDetailsPanel
                        isOpen={internal.showDetailsPanel}
                        onClose={() => internal.setShowDetailsPanel(false)}
                        mapType={internal.mapType}
                        onMapTypeChange={internal.setMapType}
                        details={internal.mapDetails}
                        onDetailToggle={internal.handleDetailToggle}
                        showLabels={internal.showLabels}
                        onLabelsToggle={() => internal.setShowLabels((prev) => !prev)}
                    />
                </>
            )}
        </Map>
    );
};
