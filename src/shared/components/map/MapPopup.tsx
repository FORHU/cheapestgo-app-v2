'use client';

import React, { useEffect, useState } from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { X } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { useUserCurrency } from '@/stores/searchStore';
import type { MappableProperty } from './types';

interface MapPopupProps {
    property: MappableProperty;
    onClose: () => void;
    onViewDetails: (id: string) => void;
    mapRef?: React.RefObject<any>;
    isCentered?: boolean;
}

const RATING_LABELS: [number, string][] = [
    [9, 'Exceptional'],
    [8, 'Excellent'],
    [7, 'Very Good'],
    [6, 'Good'],
    [0, 'Pleasant'],
];

function getRatingLabel(rating: number): string {
    for (const [threshold, label] of RATING_LABELS) {
        if (rating >= threshold) return label;
    }
    return 'Pleasant';
}

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

function StarRating({ rating, size = 10 }: { rating: number; size?: number }) {
    const pct = Math.min(100, Math.max(0, (rating / 10) * 100));
    return (
        <div className="relative inline-flex gap-px">
            {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="text-slate-200 dark:text-slate-700 flex-shrink-0">
                    <path d={STAR_PATH} fill="currentColor" />
                </svg>
            ))}
            <div className="absolute inset-0 overflow-hidden flex gap-px" style={{ width: `${pct}%` }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="text-blue-500 flex-shrink-0">
                        <path d={STAR_PATH} fill="currentColor" />
                    </svg>
                ))}
            </div>
        </div>
    );
}

function useIsLandscapeMobile() {
    const [is, setIs] = useState(false);
    useEffect(() => {
        const check = () =>
            setIs(window.innerHeight < 500 && window.innerWidth > window.innerHeight);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return is;
}

const MapPopup = React.memo(function MapPopup({
    property,
    onClose,
    onViewDetails,
    mapRef,
    isCentered = false
}: MapPopupProps) {
    const isLandscape = useIsLandscapeMobile();
    const targetCurrency = useUserCurrency();
    const sourceCurrency = property.currency || 'USD';
    const displayPrice = React.useMemo(
        () => convertCurrency(property.price, sourceCurrency, targetCurrency),
        [property.price, sourceCurrency, targetCurrency]
    );
    const displayOriginalPrice = React.useMemo(
        () => property.originalPrice
            ? convertCurrency(property.originalPrice, sourceCurrency, targetCurrency)
            : undefined,
        [property.originalPrice, sourceCurrency, targetCurrency]
    );
    const rating = property.rating ?? property.reviewScore ?? 0;
    const image = property.image ?? property.images?.[0];

    const onCloseRef = React.useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const handleMapClose = () => onCloseRef.current();
        const map = mapRef?.current?.getMap();
        if (map) {
            map.on('dragstart', handleMapClose);
            map.on('zoomstart', handleMapClose);
            map.on('wheel', handleMapClose);
        }
        return () => {
            if (map) {
                map.off('dragstart', handleMapClose);
                map.off('zoomstart', handleMapClose);
                map.off('wheel', handleMapClose);
            }
        };
    }, [mapRef]);

    const content = (
        <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl w-[240px]">
            {/* Image */}
            <div className="relative">
                {image ? (
                    <img
                        src={image}
                        alt={property.name}
                        className={`w-full object-cover ${isLandscape ? 'h-16' : 'h-24'}`}
                        loading="lazy"
                    />
                ) : (
                    <div className={`w-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center ${isLandscape ? 'h-16' : 'h-24'}`}>
                        <span className="text-xs text-slate-400">{property.name}</span>
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
                >
                    <X className="w-3 h-3 text-white" />
                </button>
                {property.refundableTag === 'RFN' && (
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-semibold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                        {isLandscape ? 'Free cancel' : 'Free cancellation'}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className={isLandscape ? 'p-1.5' : 'p-2'}>
                <h3 className={`font-bold text-slate-900 dark:text-white leading-tight truncate ${isLandscape ? 'text-[10px]' : 'text-[11px]'}`}>
                    {property.name}
                </h3>

                {rating > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                        <StarRating rating={rating} size={10} />
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">{rating.toFixed(1)} · {getRatingLabel(rating)}</span>
                    </div>
                )}

                <div className={`flex items-center justify-between border-t border-slate-100 dark:border-slate-800 ${isLandscape ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'}`}>
                    <div className="leading-none">
                        {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                            <span className="text-[8px] text-slate-400 line-through block mb-0.5">
                                {formatCurrency(displayOriginalPrice, targetCurrency)}
                            </span>
                        )}
                        <span className={`font-bold text-blue-600 dark:text-blue-400 ${isLandscape ? 'text-xs' : 'text-[13px]'}`}>
                            {formatCurrency(displayPrice, targetCurrency)}
                        </span>
                        <span className="text-[8px] text-slate-400 ml-0.5">/night</span>
                    </div>
                    <button
                        onClick={() => onViewDetails(property.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap text-[9px] px-2 py-1"
                    >
                        View Deal
                    </button>
                </div>
            </div>
        </div>
    );

    if (isCentered) return content;

    return (
        <Popup
            latitude={property.coordinates.lat}
            longitude={property.coordinates.lng}
            anchor="bottom"
            offset={isLandscape ? 25 : 60}
            closeOnClick={false}
            onClose={onClose}
            className="map-property-popup z-50"
            maxWidth="min(240px, calc(100vw - 32px))"
        >
            {content}
        </Popup>
    );
});

export { MapPopup };
export type { MapPopupProps };
