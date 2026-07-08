'use client';

import React from 'react';
import { X } from 'lucide-react';

export type MapTypeId = 'default-3d' | 'default' | 'satellite';

export interface MapDetailToggle {
    id: string;
    enabled: boolean;
}

interface MapTypeTile {
    id: MapTypeId;
    label: string;
    thumbnail: string;
}

function ExploreIcon({ size = 'w-8 h-8' }: { size?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
    );
}

const MAP_TYPE_TILES: MapTypeTile[] = [
    { id: 'default-3d', label: '3D', thumbnail: 'linear-gradient(135deg, #d4e4c8 0%, #c8d8bc 30%, #e8dcc8 60%, #ddd5c8 100%)' },
    { id: 'default',    label: 'Default', thumbnail: 'linear-gradient(135deg, #f0f0e8 0%, #e0e0d0 30%, #f5f5ed 60%, #fafafa 100%)' },
    { id: 'satellite',  label: 'Satellite', thumbnail: 'linear-gradient(135deg, #2a4a2a 0%, #1a3a2a 30%, #1a2e1a 60%, #0f1f0f 100%)' },
];

function TransitIcon({ size = 'w-8 h-8' }: { size?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="6" y="3" width="12" height="15" rx="2" />
            <circle cx="9" cy="14" r="1" fill="currentColor" />
            <circle cx="15" cy="14" r="1" fill="currentColor" />
            <path d="M9 18l-1 3M15 18l1 3M6 10h12" />
        </svg>
    );
}

function TrafficIcon({ size = 'w-8 h-8' }: { size?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="7" y="2" width="10" height="20" rx="3" />
            <circle cx="12" cy="7" r="1.5" fill="currentColor" className="text-red-400" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" className="text-yellow-400" />
            <circle cx="12" cy="17" r="1.5" fill="currentColor" className="text-green-400" />
        </svg>
    );
}

function BikingIcon({ size = 'w-8 h-8' }: { size?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="6" cy="17" r="3" />
            <circle cx="18" cy="17" r="3" />
            <path d="M6 17l4-8 4 8M10 9h4l4 8" />
            <circle cx="12" cy="5" r="1.5" fill="currentColor" />
        </svg>
    );
}

function TerrainIcon({ size = 'w-8 h-8' }: { size?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M2 20l7-12 5 8 3-4 5 8H2z" fill="currentColor" fillOpacity={0.15} />
            <path d="M2 20l7-12 5 8 3-4 5 8" />
        </svg>
    );
}

// Hardcoded labels (i18n for map panel is a separate task)
const DETAIL_LABELS: Record<string, string> = {
    explore: 'Explore',
    transit: 'Transit',
    traffic: 'Traffic',
    biking: 'Biking',
    terrain: 'Terrain',
};

const getDetailIcons = (sizeClass: string): Record<string, React.ReactNode> => ({
    explore: <ExploreIcon size={sizeClass} />,
    transit: <TransitIcon size={sizeClass} />,
    traffic: <TrafficIcon size={sizeClass} />,
    biking: <BikingIcon size={sizeClass} />,
    terrain: <TerrainIcon size={sizeClass} />,
});

interface MapDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    mapType: MapTypeId;
    onMapTypeChange: (type: MapTypeId) => void;
    details: MapDetailToggle[];
    onDetailToggle: (id: string) => void;
    showLabels: boolean;
    onLabelsToggle: () => void;
    isFullscreen?: boolean;
}

export function MapDetailsPanel({
    isOpen,
    onClose,
    mapType,
    onMapTypeChange,
    details,
    onDetailToggle,
    showLabels,
    onLabelsToggle,
}: MapDetailsPanelProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute z-[60] bg-white dark:bg-slate-900 rounded-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden w-[210px] md:w-[300px] left-4 top-[80px] lg:top-[38px]">
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5 md:px-4 md:pt-4 md:pb-2">
                <h3 className="text-xs md:text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Map Details</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <X className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                </button>
            </div>

            {/* Detail toggles */}
            <div className="px-2.5 pb-2 md:px-4 md:pb-3">
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                    {details.map((detail) => {
                        const isDisabled = detail.id === 'terrain' && mapType !== 'default-3d';
                        const icons = getDetailIcons('w-4 h-4 md:w-8 md:h-8');
                        return (
                            <button
                                key={detail.id}
                                onClick={() => onDetailToggle(detail.id)}
                                disabled={isDisabled}
                                className={`flex flex-col items-center gap-1 rounded-md border-2 transition-all cursor-pointer p-1.5 md:p-2 ${
                                    isDisabled
                                        ? 'opacity-50 cursor-not-allowed border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50'
                                        : detail.enabled
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className={detail.enabled && !isDisabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}>
                                    {icons[detail.id]}
                                </div>
                                <span className={`text-[8px] md:text-xs font-medium leading-tight ${
                                    detail.enabled && !isDisabled ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                    {DETAIL_LABELS[detail.id] ?? detail.id}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Map type */}
            <div className="px-2.5 pb-2 md:px-4 md:pb-3">
                <p className="text-[8px] md:text-xs mb-1 md:mb-2 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-0.5">Map Type</p>
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                    {MAP_TYPE_TILES.map((tile) => (
                        <button
                            key={tile.id}
                            onClick={() => onMapTypeChange(tile.id)}
                            className={`flex flex-col items-center gap-1 rounded-md border-2 overflow-hidden transition-all cursor-pointer ${
                                mapType === tile.id
                                    ? 'border-blue-500'
                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                            }`}
                        >
                            <div className="w-full bg-cover bg-center h-6 md:h-14" style={{ background: tile.thumbnail }} />
                            <span className={`text-[8px] md:text-xs pb-1 md:pb-1.5 font-medium ${
                                mapType === tile.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                            }`}>
                                {tile.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Labels toggle */}
            <div className="px-3 pb-2 pt-1.5 md:px-5 md:pb-5 md:pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-0.5">
                <span className="text-[10px] md:text-sm font-medium text-slate-700 dark:text-slate-300">Labels</span>
                <button
                    onClick={onLabelsToggle}
                    className={`relative rounded-full transition-colors cursor-pointer w-8 h-4 md:w-11 md:h-6 ${showLabels ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow-lg transition-transform w-3 h-3 md:translate-y-0.5 ${showLabels ? 'translate-x-4 md:translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>
        </div>
    );
}
