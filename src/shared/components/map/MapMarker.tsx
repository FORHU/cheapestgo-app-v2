import React, { useState } from 'react';
import Image from 'next/image';
import { Marker } from 'react-map-gl/mapbox';
import { Bed } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import type { MappableProperty } from './types';

interface MapMarkerProps {
    property: MappableProperty;
    displayPrice?: number;
    displayCurrency?: string;
    isSelected: boolean;
    isHovered: boolean;
    onClick: (id: string) => void;
    onHover: (id: string | null) => void;
    index?: number;
}

/** Thumbnail edge, in px. Small enough that `sizes` pulls a tiny variant. */
const THUMB = 26;

const MapMarker = React.memo(function MapMarker({
    property,
    displayPrice,
    displayCurrency,
    isSelected,
    isHovered,
    onClick,
    onHover,
    index,
}: MapMarkerProps) {
    const isActive = isSelected || isHovered;

    // A supplier image that 404s would otherwise leave a grey hole in the pill.
    const [imageFailed, setImageFailed] = useState(false);
    const thumbnail = property.image ?? property.images?.[0];
    const showThumbnail = Boolean(thumbnail) && !imageFailed;

    return (
        <Marker
            latitude={property.coordinates.lat}
            longitude={property.coordinates.lng}
            // Still bottom-anchored even though the pill no longer has a tail,
            // so the popup offsets in MapPopup keep working unchanged.
            anchor="bottom"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick(property.id);
            }}
            style={{
                zIndex: isSelected ? 20 : isHovered ? 10 : 1,
                cursor: 'pointer',
            }}
        >
            <div
                onMouseEnter={() => onHover(property.id)}
                onMouseLeave={() => onHover(null)}
                className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-white p-1 pr-2 ring-1 transition-transform dark:bg-slate-900',
                    isActive ? 'shadow-lg ring-blue-500/60' : 'shadow-md ring-black/[0.08] dark:ring-white/10',
                    isSelected ? '-translate-y-1 scale-110' : 'scale-100'
                )}
            >
                {/* Thumbnail */}
                <div
                    className="relative shrink-0 overflow-hidden rounded-[7px] bg-slate-100 dark:bg-slate-800"
                    style={{ width: THUMB, height: THUMB }}
                >
                    {showThumbnail ? (
                        <Image
                            src={thumbnail as string}
                            alt=""
                            fill
                            sizes={`${THUMB}px`}
                            className="object-cover"
                            onError={() => setImageFailed(true)}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Bed className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                    )}

                    {/* Keeps the marker tied to its numbered row in the results list. */}
                    {index !== undefined && (
                        <span
                            className={cn(
                                'absolute left-0 top-0 flex items-center justify-center rounded-br-[6px] px-[3px] font-bold leading-none text-white',
                                isSelected ? 'bg-blue-700' : 'bg-blue-600',
                                index > 99 ? 'text-[6px]' : 'text-[8px]'
                            )}
                            style={{ minWidth: 13, height: 13 }}
                        >
                            {index}
                        </span>
                    )}
                </div>

                {/* Price */}
                <span className="whitespace-nowrap text-[12px] font-bold tracking-tight text-slate-900 dark:text-white">
                    {property.priceLoading ? (
                        <span className="tracking-widest text-slate-400">···</span>
                    ) : (
                        formatCurrency(displayPrice ?? property.price, displayCurrency ?? property.currency)
                    )}
                </span>
            </div>
        </Marker>
    );
});

export { MapMarker };
export type { MapMarkerProps };
