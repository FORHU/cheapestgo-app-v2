'use client';

import React from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { X, Navigation, ExternalLink } from 'lucide-react';
import type { NearbyPlace } from './useMapNearbyPlaces';

interface NearbyPlacePopupProps {
    place: NearbyPlace;
    distanceKm: number | null;
    onClose: () => void;
}

function formatCategory(raw: string): string {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDistance(km: number): string {
    return km < 1
        ? `${Math.round(km * 1000)} m from hotel`
        : `${km.toFixed(2)} km from hotel`;
}

function getRatingLabel(rating: number): string {
    if (rating >= 4.5) return 'Exceptional';
    if (rating >= 4.0) return 'Excellent';
    if (rating >= 3.5) return 'Very Good';
    if (rating >= 3.0) return 'Good';
    return 'Pleasant';
}

function getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'bg-emerald-600';
    if (rating >= 4.0) return 'bg-blue-600';
    if (rating >= 3.5) return 'bg-blue-500';
    if (rating >= 3.0) return 'bg-amber-500';
    return 'bg-orange-500';
}

const NearbyPlacePopup = React.memo(function NearbyPlacePopup({
    place,
    distanceKm,
    onClose,
}: NearbyPlacePopupProps) {
    const mapsUrl = place.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
        : `https://maps.google.com/?q=${place.lat},${place.lng}`;

    return (
        <Popup
            latitude={place.lat}
            longitude={place.lng}
            anchor="bottom"
            offset={24}
            closeOnClick={false}
            closeButton={false}
            onClose={onClose}
            className="map-poi-popup"
            maxWidth="250px"
        >
            <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800 min-w-[200px]">
                <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="font-bold text-[11px] text-slate-900 dark:text-white leading-tight">
                                {place.name}
                            </h3>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {formatCategory(place.category)}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0 cursor-pointer mt-0.5"
                        >
                            <X className="w-3 h-3 text-slate-500" />
                        </button>
                    </div>

                    {place.rating !== undefined && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[9px] font-bold text-white px-1 py-px rounded ${getRatingColor(place.rating)}`}>
                                {place.rating.toFixed(1)}
                            </span>
                            <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300">
                                {getRatingLabel(place.rating)}
                            </span>
                            {place.userRatingsTotal !== undefined && (
                                <span className="text-[9px] text-slate-400">
                                    ({place.userRatingsTotal.toLocaleString()})
                                </span>
                            )}
                        </div>
                    )}

                    {place.vicinity && (
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight line-clamp-2">
                            {place.vicinity}
                        </p>
                    )}

                    {distanceKm !== null && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            <Navigation className="w-3 h-3 flex-shrink-0" />
                            <span>{formatDistance(distanceKm)}</span>
                        </div>
                    )}

                    <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        View on Google Maps
                    </a>
                </div>
            </div>
        </Popup>
    );
});

export { NearbyPlacePopup };
export type { NearbyPlacePopupProps };
