import React from 'react';
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

    return (
        <Marker
            latitude={property.coordinates.lat}
            longitude={property.coordinates.lng}
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
                    'flex flex-col items-center group cursor-pointer',
                    isSelected ? 'scale-110 -translate-y-1' : 'scale-100'
                )}
            >
                {/* Marker Container (Pill) */}
                <div className={cn(
                    'flex items-center gap-2 px-1.5 py-1 rounded-full bg-white dark:bg-slate-900 shadow-md ring-1 ring-black/5 dark:ring-white/10',
                    isActive ? 'ring-blue-500/50 shadow-lg' : ''
                )}>
                    {/* Icon Circle / Number Badge */}
                    <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center',
                        isSelected ? 'bg-blue-700' : 'bg-blue-500'
                    )}>
                        {index !== undefined ? (
                            <span className={cn(
                                'text-white font-bold leading-none',
                                index > 99 ? 'text-[9px]' : index > 9 ? 'text-[11px]' : 'text-[13px]'
                            )}>
                                {index}
                            </span>
                        ) : (
                            <Bed className="w-3.5 h-3.5 text-white" />
                        )}
                    </div>

                    {/* Price Label */}
                    <div className="pr-2 text-[11px] font-bold text-slate-800 dark:text-white whitespace-nowrap tracking-tight">
                        {property.priceLoading
                            ? <span className="text-slate-400 tracking-widest">···</span>
                            : formatCurrency(displayPrice ?? property.price, displayCurrency ?? property.currency)
                        }
                    </div>
                </div>

                {/* Triangle Tail */}
                <div className={cn(
                    'w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] -mt-[1px]',
                    isSelected ? 'border-t-blue-700' : 'border-t-white dark:border-t-slate-900'
                )} />
            </div>
        </Marker>
    );
});

export { MapMarker };
export type { MapMarkerProps };
