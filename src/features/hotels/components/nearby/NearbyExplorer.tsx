'use client';

/**
 * Nearby places on the property page: v1's property map, rebuilt
 * (docs/superpowers/specs/2026-10-08-nearby-places-v1-parity-design.md).
 *
 * Owns the section's state and hands each piece only the slice it draws.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MapRef } from 'react-map-gl/mapbox';
import type { PoiCategory } from '@/shared/config/map-discovery';
import { useNearbyGems, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { nearestRadius } from '@/shared/lib/distance';
import { cn } from '@/shared/lib/cn';
import { NearbyMap } from './NearbyMap';
import { PlaceCards, PlaceFilters } from './PlaceStrip';
import { PlaceDetailsModal } from './PlaceDetailsModal';
import type { LatLng, NearbyPalette } from './types';

interface NearbyExplorerProps {
    coordinates: LatLng;
    hotelName: string;
    palette: NearbyPalette;
    /**
     * Merged over the default stack of map-then-strip. The property page passes
     * `contents`, so the map and the strip land in its own grid rows instead —
     * the map in the row it shares with the room list.
     */
    className?: string;
    /** Merged over the map frame's default fixed height. */
    mapClassName?: string;
}

export function NearbyExplorer({ coordinates, hotelName, palette, className, mapClassName }: NearbyExplorerProps) {
    const t = useTranslations('property.nearby');
    const mapRef = useRef<MapRef>(null);
    const [unit, setUnit] = useDistanceUnit();
    const [category, setCategory] = useState<PoiCategory>('all');
    // Start on a round step in the viewer's unit so the first fetch is already the right one.
    const [radius, setRadius] = useState(() => nearestRadius(2000, unit));
    const [activeId, setActiveId] = useState<string | null>(null);
    const [detailsId, setDetailsId] = useState<string | null>(null);

    // The radius picker offers round steps in the viewer's unit; keep the selection on one of
    // them when the unit flips after mount (the initial value above already matches).
    const prevUnit = useRef(unit);
    useEffect(() => {
        if (prevUnit.current === unit) return;
        prevUnit.current = unit;
        setRadius((r) => nearestRadius(r, unit));
    }, [unit]);

    const { gems, loading, error, retry } = useNearbyGems({ coordinates, category, radiusMeters: radius });
    const active = gems.find((g) => g.id === activeId) ?? null;
    const detailsGem = gems.find((g) => g.id === detailsId) ?? null;

    const select = useCallback((gem: NearbyGem) => {
        if (gem.id === activeId) {
            setActiveId(null);
            return;
        }
        setActiveId(gem.id);
        mapRef.current?.flyTo({ center: [gem.coordinates.lng, gem.coordinates.lat], zoom: 16, duration: 800 });
    }, [activeId]);

    const changeCategory = useCallback((next: PoiCategory) => {
        setCategory(next);
        setActiveId(null);
    }, []);

    const showDetails = useCallback((gem: NearbyGem) => setDetailsId(gem.id), []);
    const closeDetails = useCallback(() => setDetailsId(null), []);

    return (
        <div className={cn('flex flex-col gap-3.5', className)}>
            <div className={cn('h-[420px]', mapClassName)}>
                <NearbyMap
                    mapRef={mapRef}
                    hotel={coordinates}
                    hotelLabel={hotelName || t('hotel')}
                    places={gems}
                    activeId={active?.id ?? null}
                    onSelect={select}
                    mapStyle={palette.mapStyle}
                    route={null}
                    height="100%"
                >
                    {/* The places ride the map's bottom edge, lifted clear of the
                        Mapbox logo and attribution, which have to stay visible. */}
                    <PlaceCards
                        className="absolute inset-x-0 bottom-8 z-10"
                        gems={gems}
                        loading={loading}
                        error={error}
                        onRetry={retry}
                        unit={unit}
                        hotel={coordinates}
                        activeId={active?.id ?? null}
                        onSelect={select}
                        onDetails={showDetails}
                        palette={palette}
                    />
                </NearbyMap>
            </div>
            <PlaceFilters
                gems={gems}
                error={error}
                onRetry={retry}
                category={category}
                onCategoryChange={changeCategory}
                radius={radius}
                onRadiusChange={setRadius}
                unit={unit}
                onUnitChange={setUnit}
                palette={palette}
            />
            <PlaceDetailsModal gem={detailsGem} hotel={coordinates} unit={unit} palette={palette} onClose={closeDetails} />
        </div>
    );
}
